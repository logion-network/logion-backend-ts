import { AuthenticatedUser } from "@logion/authenticator";
import { getVerifiedIssuers, UUID } from "@logion/node-api";
import { AuthenticationService, forbidden, PolkadotService } from '@logion/rest-api-core';
import { Request } from 'express';
import { injectable } from 'inversify';
import { LocRequestAggregateRoot } from '../model/locrequest.model';

@injectable()
export class LocAuthorizationService {

    constructor(
        private authenticationService: AuthenticationService,
        private polkadotService: PolkadotService,
    ) {}

    async ensureContributor(httpRequest: Request, request: LocRequestAggregateRoot): Promise<string> {
        const authenticatedUser = await this.authenticationService.authenticatedUser(httpRequest);
        if (await this.isContributor(request, authenticatedUser)) {
            return authenticatedUser.address;
        } else {
            throw forbidden("Authenticated user is not allowed to contribute to this LOC");
        }
    }

    async isContributor(request: LocRequestAggregateRoot, contributor: AuthenticatedUser): Promise<boolean> {
        return (
            (request.ownerAddress === contributor.address && contributor.isPolkadot()) ||
            (request.requesterAddress === contributor.address && request.requesterAddressType === contributor.type) ||
            await this.isSelectedThirdParty(request, contributor)
        );
    }

    private async isSelectedThirdParty(request: LocRequestAggregateRoot, submitter: AuthenticatedUser): Promise<boolean> {
        if (!submitter.isPolkadot()) {
            return false;
        }
        const api = await this.polkadotService.readyApi();
        const issuers = await getVerifiedIssuers(api, new UUID(request.id));
        const selectedParticipant = issuers.find(issuer => issuer.address === submitter.address);
        return selectedParticipant !== undefined;
    }
}
