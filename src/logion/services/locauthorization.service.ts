import { AuthenticatedUser } from "@logion/authenticator";
import { UUID } from "@logion/node-api";
import { AuthenticationService, forbidden, PolkadotService } from '@logion/rest-api-core';
import { Request } from 'express';
import { injectable } from 'inversify';
import { LocRequestAggregateRoot } from '../model/locrequest.model';
import { SupportedAccountId, accountEquals } from "../model/supportedaccountid.model.js";

export class Contribution {
    readonly httpRequest: Request;
    readonly locRequest: LocRequestAggregateRoot;
    readonly allowInvitedContributor: boolean;
    readonly allowOwner:boolean;

    private constructor(httpRequest: Request, locRequest: LocRequestAggregateRoot, allowInvitedContributor: boolean, allowOwner: boolean) {
        this.httpRequest = httpRequest;
        this.locRequest = locRequest;
        this.allowInvitedContributor = allowInvitedContributor;
        this.allowOwner = allowOwner;
    }

    ownerCanContributeItems(): boolean {
        if (this.allowOwner) {
            return true;
        }
        const requester = this.locRequest.getRequester();
        return requester === undefined || requester.type !== "Polkadot"
    }

    public static itemContribution(httpRequest: Request, locRequest: LocRequestAggregateRoot): Contribution {
        return new Contribution(httpRequest, locRequest, false, false);
    }

    public static locContribution(httpRequest: Request, locRequest: LocRequestAggregateRoot): Contribution {
        return new Contribution(httpRequest, locRequest, false, true);
    }

    public static recordContribution(httpRequest: Request, locRequest: LocRequestAggregateRoot): Contribution {
        return new Contribution(httpRequest, locRequest, true, false);
    }
}
@injectable()
export class LocAuthorizationService {

    constructor(
        private authenticationService: AuthenticationService,
        private polkadotService: PolkadotService,
    ) {}

    // async ensureContributor(httpRequest: Request, request: LocRequestAggregateRoot, allowInvitedContributor = false, allowOwner = true): Promise<SupportedAccountId> {
    async ensureContributor(contribution: Contribution): Promise<SupportedAccountId> {
        const { httpRequest, locRequest, allowInvitedContributor } = contribution
        const authenticatedUser = await this.authenticationService.authenticatedUser(httpRequest);
        if (await this.isContributor(contribution, authenticatedUser)) {
            return authenticatedUser;
        } else if (allowInvitedContributor && await this.isInvitedContributor(locRequest, authenticatedUser)) {
            return authenticatedUser;
        } else {
            throw forbidden("Authenticated user is not allowed to contribute to this LOC");
        }
    }

    // async isContributor(request: LocRequestAggregateRoot, contributor: AuthenticatedUser, allowOwner = true): Promise<boolean> {
    async isContributor(contribution: Contribution, contributor: AuthenticatedUser): Promise<boolean> {
        const { locRequest } = contribution;
        return (
            (accountEquals(locRequest.getOwner(), contributor) && contribution.ownerCanContributeItems()) ||
            accountEquals(locRequest.getRequester(), contributor) ||
            await this.isSelectedIssuer(locRequest, contributor)
        );
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
