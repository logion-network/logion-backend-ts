import { injectable } from "inversify";
import { Controller, ApiController, Async, HttpPost } from "dinoloop";
import { components } from "./components.js";
import { OpenAPIV3 } from "express-oas-generator";
import {
    addTag,
    setControllerTag,
    AuthenticationService,
    getDefaultResponses,
    requireDefined,
    setPathParameters,
    getDefaultResponsesWithAnyBody,
    badRequest,
} from "@logion/rest-api-core";
import { IdenfyService } from "../services/idenfy/idenfy.service.js";
import { LocRequestRepository } from "../model/locrequest.model.js";
import { IdenfyCallbackPayload } from "../services/idenfy/idenfy.types.js";

export function fillInSpec(spec: OpenAPIV3.Document): void {
    const tagName = 'iDenfy integration';
    addTag(spec, {
        name: tagName,
        description: "Provides iDenfy-related resources"
    });
    setControllerTag(spec, /^\/api\/idenfy.*/, tagName);

    IdenfyController.createVerificationSession(spec);
    IdenfyController.callback(spec);
}

type IdenfyVerificationCreationView = components["schemas"]["IdenfyVerificationCreationView"];
type IdenfyVerificationRedirectView = components["schemas"]["IdenfyVerificationRedirectView"];

@injectable()
@Controller('/idenfy')
export class IdenfyController extends ApiController {

    constructor(
        private authenticationService: AuthenticationService,
        private idenfyService: IdenfyService,
        private locRequestRepository: LocRequestRepository,
    ) {
        super();
    }

    static createVerificationSession(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/idenfy/verification-session/{locId}"].post!;
        operationObject.summary = "Initiates an iDenfy verification session";
        operationObject.description = "Requires authentication and the user to be the requester of target Identity LOC.";
        operationObject.responses = getDefaultResponses("IdenfyVerificationRedirectView");
        setPathParameters(operationObject, {
            locId: "The target Identity LOC ID",
        });
    }

    @HttpPost('/verification-session/:locId')
    @Async()
    async createVerificationSession(idenfyVerificationCreation: IdenfyVerificationCreationView, locId: string): Promise<IdenfyVerificationRedirectView> {
        const authenticatedUser = await this.authenticationService.authenticatedUser(this.request);
        const request = requireDefined(await this.locRequestRepository.findById(locId), () => badRequest("LOC not found"));
        authenticatedUser.require(user => requireDefined(request.getRequester()).equals(user.validAccountId),
            "Only LOC requester can start an identity verification session");
        return await this.idenfyService.createVerificationSession(request, idenfyVerificationCreation);
    }

    static callback(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/idenfy/callback"].post!;
        operationObject.summary = "Webhook called by iDenfy at the end of a verification process";
        operationObject.description = "The security of the endpoint is managed by verifying signature provided in the header 'idenfy-signature'.";
        operationObject.responses = getDefaultResponsesWithAnyBody();
    }

    @HttpPost('/callback')
    @Async()
    async callback(body: unknown): Promise<void> {
        const payload = body as IdenfyCallbackPayload;
        if(!payload.final) {
            return;
        }

        if(!(this.request.rawBody instanceof Buffer)) {
            throw new Error(`Unexpected raw body type: ${typeof this.request.rawBody}`);
        }
        if(!("idenfy-signature" in this.request.headers)) {
            throw new Error(`Missing signature header`);
        }
        if(typeof this.request.headers["idenfy-signature"] !== "string") {
            throw new Error(`Unexpected signature header type: ${typeof this.request.headers["idenfy-signature"]}`);
        }

        await this.idenfyService.callback(payload, this.request.rawBody, this.request.headers["idenfy-signature"]);
    }
}
