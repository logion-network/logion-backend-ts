import { injectable } from "inversify";
import { Controller, ApiController, Async, HttpGet } from "dinoloop";
import { OpenAPIV3 } from "express-oas-generator";
import { addTag, AuthenticationService, badRequest, getDefaultResponses, getRequestBody, Log, PolkadotService, requireDefined, setControllerTag, setPathParameters } from "@logion/rest-api-core";
import { components } from "./components.js";
import { LocRequestRepository } from "../model/locrequest.model.js";

import { UUID, getVerifiedIssuers, VerifiedIssuer, getLegalOfficerVerifiedIssuers } from "@logion/node-api";
import { toUserIdentityView } from "./adapters/locrequestadapter.js";

export function fillInSpec(spec: OpenAPIV3.Document): void {
    const tagName = 'Verified Third Parties';
    addTag(spec, {
        name: tagName,
        description: "Handling of Verified Third Parties"
    });
    setControllerTag(spec, /^\/api\/loc-request\/.*\/issuers-identity$/, tagName);

    VerifiedThirdPartyController.getVerifiedIssuersIdentity(spec);
}

type VerifiedIssuersIdentityResponse = components["schemas"]["VerifiedIssuersIdentityResponse"];
type VerifiedIssuerIdentity = components["schemas"]["VerifiedIssuerIdentity"];

@injectable()
@Controller('')
export class VerifiedThirdPartyController extends ApiController {

    constructor(
        private locRequestRepository: LocRequestRepository,
        private authenticationService: AuthenticationService,
        private polkadotService: PolkadotService,
    ) {
        super();
    }

    static getVerifiedIssuersIdentity(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/{requestId}/issuers-identity"].get!;
        operationObject.summary = "Providers selected issuers identity";
        operationObject.description = "The authenticated user must be the owner or the requester of the LOC.";
        operationObject.responses = getDefaultResponses("");
        operationObject.requestBody = getRequestBody({
            description: "VTP flag",
            view: "SetVerifiedThirdPartyRequest",
        });
        setPathParameters(operationObject, {
            'issuerAddress': "The VTP address",
        });
    }

    @HttpGet('/loc-request/:requestId/issuers-identity')
    @Async()
    async getVerifiedIssuersIdentity(_body: never, requestId: string): Promise<VerifiedIssuersIdentityResponse> {
        const authenticatedUser = await this.authenticationService.authenticatedUser(this.request);
        const locRequest = requireDefined(await this.locRequestRepository.findById(requestId)).getDescription();
        authenticatedUser.require(user => user.is(locRequest.ownerAddress) || user.is(locRequest.requesterAddress));

        const api = await this.polkadotService.readyApi();
        const issuers = await getVerifiedIssuers(api, new UUID(requestId));

        return {
            issuers: await this.toVerifiedIssuersIdentityResponse(locRequest.ownerAddress, issuers),
        };
    }

    private async toVerifiedIssuersIdentityResponse(legalOfficerAddress: string, issuers: VerifiedIssuer[]): Promise<VerifiedIssuerIdentity[]> {
        const issuersIdentity: VerifiedIssuerIdentity[] = [];
        for(const issuer of issuers) {
            const identityLoc = await this.getIssuerIdentityLoc(legalOfficerAddress, issuer.address);
            issuersIdentity.push({
                address: issuer.address,
                identity: toUserIdentityView(identityLoc.getDescription().userIdentity),
                identityLocId: identityLoc.id,
            });
        }
        return issuersIdentity;
    }

    private async getIssuerIdentityLoc(legalOfficerAddress: string, issuerAddress: string) {
        const api = await this.polkadotService.readyApi();
        const verifiedIssuer = await api.query.logionLoc.verifiedIssuersMap(legalOfficerAddress, issuerAddress);
        if(verifiedIssuer.isNone) {
            throw badRequest(`${issuerAddress} is not an issuer of LO ${legalOfficerAddress}`);
        }

        const identityLocId = UUID.fromDecimalStringOrThrow(verifiedIssuer.unwrap().identityLoc.toString());
        const identityLoc = await this.locRequestRepository.findById(identityLocId.toString());
        if(!identityLoc) {
            throw badRequest("No Identity LOC available for issuer");
        }
        return identityLoc;
    }

    @HttpGet('/issuers-identity')
    @Async()
    async getLegalOfficerVerifiedIssuersIdentity(_body: never): Promise<VerifiedIssuersIdentityResponse> {
        const authenticatedUser = await this.authenticationService.authenticatedUser(this.request);
        await authenticatedUser.requireLegalOfficerOnNode();

        const api = await this.polkadotService.readyApi();
        const issuers = await getLegalOfficerVerifiedIssuers(api, authenticatedUser.address);

        return {
            issuers: await this.toVerifiedIssuersIdentityResponse(authenticatedUser.address, issuers),
        };
    }
}
