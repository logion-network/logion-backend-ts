import { injectable } from "inversify";
import { Controller, ApiController, Async, HttpGet } from "dinoloop";
import { OpenAPIV3 } from "express-oas-generator";
import { addTag, AuthenticationService, badRequest, PolkadotService, setControllerTag } from "@logion/rest-api-core";
import { components } from "./components.js";
import { LocRequestRepository } from "../model/locrequest.model.js";

import { UUID, VerifiedIssuerType } from "@logion/node-api";
import { toUserIdentityView } from "./adapters/locrequestadapter.js";

export function fillInSpec(spec: OpenAPIV3.Document): void {
    const tagName = 'Verified Issuers';
    addTag(spec, {
        name: tagName,
        description: "Handling of Verified Issuers"
    });
    setControllerTag(spec, /^\/api\/issuers-identity$/, tagName);
}

type VerifiedIssuersIdentityResponse = components["schemas"]["VerifiedIssuersIdentityResponse"];
type VerifiedIssuerIdentity = components["schemas"]["VerifiedIssuerIdentity"];

@injectable()
@Controller('')
export class VerifiedIssuerController extends ApiController {

    constructor(
        private locRequestRepository: LocRequestRepository,
        private authenticationService: AuthenticationService,
        private polkadotService: PolkadotService,
    ) {
        super();
    }

    @HttpGet('/issuers-identity')
    @Async()
    async getLegalOfficerVerifiedIssuersIdentity(_body: never): Promise<VerifiedIssuersIdentityResponse> {
        const authenticatedUser = await this.authenticationService.authenticatedUser(this.request);
        await authenticatedUser.requireLegalOfficerOnNode();

        const api = await this.polkadotService.readyApi();
        const issuers = await api.queries.getLegalOfficerVerifiedIssuers(authenticatedUser.address);

        return {
            issuers: await this.toVerifiedIssuersIdentityResponse(authenticatedUser.address, issuers),
        };
    }

    private async toVerifiedIssuersIdentityResponse(legalOfficerAddress: string, issuers: VerifiedIssuerType[]): Promise<VerifiedIssuerIdentity[]> {
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
        const verifiedIssuer = await api.polkadot.query.logionLoc.verifiedIssuersMap(legalOfficerAddress, issuerAddress);
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
}
