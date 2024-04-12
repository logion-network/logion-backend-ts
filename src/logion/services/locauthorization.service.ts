import { AuthenticatedUser } from "@logion/authenticator";
import { UUID, ValidAccountId } from "@logion/node-api";
import { AuthenticationService, forbidden, PolkadotService } from '@logion/rest-api-core';
import { Request } from 'express';
import { injectable } from 'inversify';
import { LocRequestAggregateRoot } from '../model/locrequest.model';
import { VoteRepository } from "../model/vote.model.js";

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
        return new Contribution(httpRequest, locRequest, true, true);
    }
}
@injectable()
export class LocAuthorizationService {

    constructor(
        private authenticationService: AuthenticationService,
        private polkadotService: PolkadotService,
        private voteRepository: VoteRepository,
    ) {}

    async ensureContributor(contribution: Contribution): Promise<ValidAccountId> {
        const { httpRequest, locRequest, allowInvitedContributor } = contribution
        const authenticatedAccount = (await this.authenticationService.authenticatedUser(httpRequest)).validAccountId;
        if (await this.isContributor(contribution, authenticatedAccount)) {
            return authenticatedAccount;
        } else if (allowInvitedContributor && await this.isInvitedContributor(locRequest, authenticatedAccount)) {
            return authenticatedAccount;
        } else {
            throw forbidden("Authenticated user is not allowed to contribute to this LOC");
        }
    }

    async isContributor(contribution: Contribution, contributor: ValidAccountId): Promise<boolean> {
        const { locRequest } = contribution;
        return (
            (locRequest.getOwner().equals(contributor) && contribution.ownerCanContributeItems()) ||
            contributor.equals(locRequest.getRequester()) ||
            await this.isSelectedIssuer(locRequest, contributor)
        );
    }

    async isVoterOnLoc(request: LocRequestAggregateRoot, authenticatedUser: AuthenticatedUser): Promise<boolean> {
        return (
            await authenticatedUser.isLegalOfficer() &&
            await this.voteRepository.findByLocId(request.id!) !== null
        );
    }

    private async isSelectedIssuer(request: LocRequestAggregateRoot, submitter: ValidAccountId): Promise<boolean> {
        if (submitter.type !== "Polkadot") {
            return false;
        }
        const api = await this.polkadotService.readyApi();
        const locId = new UUID(request.id);
        const issuers = (await api.batch.locs([ locId ]).getLocsVerifiedIssuers())[ locId.toDecimalString() ];
        const selectedParticipant = issuers.find(issuer => issuer.account.equals(submitter));
        return selectedParticipant !== undefined;
    }

    private async isInvitedContributor(request: LocRequestAggregateRoot, submitter: ValidAccountId): Promise<boolean> {
        if (submitter.type !== "Polkadot") {
            return false;
        }
        const api = await this.polkadotService.readyApi();
        const locId = new UUID(request.id);
        return await api.queries.isInvitedContributorOf(submitter, locId);
    }
}
