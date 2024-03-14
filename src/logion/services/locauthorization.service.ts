import { AuthenticatedUser } from "@logion/authenticator";
import { UUID } from "@logion/node-api";
import { AuthenticationService, forbidden, PolkadotService } from '@logion/rest-api-core';
import { Request } from 'express';
import { injectable } from 'inversify';
import { LocRequestAggregateRoot } from '../model/locrequest.model';
import { SupportedAccountId, accountEquals } from "../model/supportedaccountid.model.js";

@injectable()
export class LocAuthorizationService {

    constructor(
        private authenticationService: AuthenticationService,
        private polkadotService: PolkadotService,
    ) {}

    async ensureContributor(httpRequest: Request, request: LocRequestAggregateRoot, allowInvitedContributor = false, allowOwner = true): Promise<SupportedAccountId> {
        const authenticatedUser = await this.authenticationService.authenticatedUser(httpRequest);
        if (await this.isContributor(request, authenticatedUser, allowOwner)) {
            return authenticatedUser;
        } else if (allowInvitedContributor && await this.isInvitedContributor(request, authenticatedUser)) {
            return authenticatedUser;
        } else {
            throw forbidden("Authenticated user is not allowed to contribute to this LOC");
        }
    }

    async isContributor(request: LocRequestAggregateRoot, contributor: AuthenticatedUser, allowOwner = true): Promise<boolean> {
        return (
            (accountEquals(request.getOwner(), contributor) && this.ownerCanContributeItems(request, allowOwner)) ||
            accountEquals(request.getRequester(), contributor) ||
            await this.isSelectedIssuer(request, contributor)
        );
    }

    private ownerCanContributeItems(request: LocRequestAggregateRoot, allowOwner: boolean): boolean {
        if (allowOwner) {
            return true;
        }
        const requester = request.getRequester();
        return requester === undefined || requester.type !== "Polkadot"
    }

    private async isSelectedIssuer(request: LocRequestAggregateRoot, submitter: AuthenticatedUser): Promise<boolean> {
        if (!submitter.isPolkadot()) {
            return false;
        }
        const api = await this.polkadotService.readyApi();
        const locId = new UUID(request.id);
        const issuers = (await api.batch.locs([ locId ]).getLocsVerifiedIssuers())[ locId.toDecimalString() ];
        const selectedParticipant = issuers.find(issuer => issuer.address === submitter.address);
        return selectedParticipant !== undefined;
    }

    private async isInvitedContributor(request: LocRequestAggregateRoot, submitter: AuthenticatedUser): Promise<boolean> {
        if (!submitter.isPolkadot()) {
            return false;
        }
        const api = await this.polkadotService.readyApi();
        const locId = new UUID(request.id);
        return await api.queries.isInvitedContributorOf(submitter.address, locId);
    }
}
