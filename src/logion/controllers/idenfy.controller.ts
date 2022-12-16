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
    forbidden,
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
    async createVerificationSession(_body: never, locId: string): Promise<IdenfyVerificationRedirectView> {
        const authenticatedUser = await this.authenticationService.authenticatedUser(this.request);
        const request = requireDefined(await this.locRequestRepository.findById(locId), () => badRequest("LOC not found"));
        authenticatedUser.require(user => request.requesterAddress === user.address,
            "Only LOC requester can start an identity verification session");
        return await this.idenfyService.createVerificationSession(request);
    }

    static callback(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/idenfy/callback/{secret}"].post!;
        operationObject.summary = "Webhook called by iDenfy at the end of a verification process";
        operationObject.description = "The security of the endpoint is managed by expecting a secret which is shared only between the backend and iDenfy at session creation time.";
        operationObject.responses = getDefaultResponsesWithAnyBody();
        setPathParameters(operationObject, {
            secret: "The shared secret",
        });
    }

    @HttpPost('/callback/:secret')
    @Async()
    async callback(body: any, secret: string): Promise<void> {
        if(secret !== process.env.IDENFY_SECRET) {
            throw forbidden("Bad secret");
        }
        await this.idenfyService.callback(body as IdenfyCallbackPayload, this.request.rawBody);
    }
}
