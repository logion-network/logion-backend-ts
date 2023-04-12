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
        if (authenticatedUser.isPolkadot() && await this.isContributor(request, authenticatedUser)) {
            return authenticatedUser.address;
        } else {
            throw forbidden("Authenticated user is not allowed to contribute to this LOC");
        }
    }

    async isContributor(request: LocRequestAggregateRoot, authenticatedUser: AuthenticatedUser): Promise<boolean> {
        const contributor = authenticatedUser.address;
        return (
            request.ownerAddress === contributor ||
            request.requesterAddress === contributor ||
            await this.isSelectedThirdParty(request, contributor)
        );
    }

    private async isSelectedThirdParty(request: LocRequestAggregateRoot, submitter: string): Promise<boolean> {
        const api = await this.polkadotService.readyApi();
        const issuers = await getVerifiedIssuers(api, new UUID(request.id));
        const selectedParticipant = issuers.find(issuer => issuer.address === submitter);
        return selectedParticipant !== undefined;
    }
}
