import { injectable } from "inversify";
import { Controller, ApiController, Async, HttpPut, SendsResponse } from "dinoloop";
import { OpenAPIV3 } from "express-oas-generator";
import { addTag, AuthenticationService, getDefaultResponsesNoContent, getRequestBody, requireDefined, setControllerTag, setPathParameters } from "@logion/rest-api-core";
import { components } from "./components";
import { LocRequestRepository } from "../model/locrequest.model";

export function fillInSpec(spec: OpenAPIV3.Document): void {
    const tagName = 'Verified Third Parties';
    addTag(spec, {
        name: tagName,
        description: "Handling of Verified Third Parties"
    });
    setControllerTag(spec, /^\/api\/loc-request\/.*\/verified-third-party$/, tagName);

    VerifiedThirdPartyController.setVerifiedThirdParty(spec);
}

type SetVerifiedThirdPartyRequest = components["schemas"]["SetVerifiedThirdPartyRequest"];

@injectable()
@Controller('')
export class VerifiedThirdPartyController extends ApiController {

    constructor(
        private locRequestRepository: LocRequestRepository,
        private authenticationService: AuthenticationService,
    ) {
        super();
    }

    static setVerifiedThirdParty(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/{requestId}/verified-third-party"].put!;
        operationObject.summary = "Sets the VTP flag of the closed Identity LOC";
        operationObject.description = "The authenticated user must be the owner of the LOC.";
        operationObject.responses = getDefaultResponsesNoContent();
        operationObject.requestBody = getRequestBody({
            description: "VTP flag",
            view: "SetVerifiedThirdPartyRequest",
        });
        setPathParameters(operationObject, {
            'requestId': "The ID of the LOC",
        });
    }

    @HttpPut('/loc-request/:requestId/verified-third-party')
    @Async()
    @SendsResponse()
    async setVerifiedThirdParty(body: SetVerifiedThirdPartyRequest, requestId: string) {
        const request = requireDefined(await this.locRequestRepository.findById(requestId));
        const userCheck = await this.authenticationService.authenticatedUser(this.request);
        userCheck.require(user => user.is(request.ownerAddress));
        request.setVerifiedThirdParty(body.isVerifiedThirdParty || false);
        await this.locRequestRepository.save(request);
        this.response.sendStatus(204);
    }
}
