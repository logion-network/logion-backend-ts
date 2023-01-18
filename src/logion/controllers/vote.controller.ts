import { ApiController, Controller, Async, HttpGet } from "dinoloop";
import { injectable } from "inversify";
import { components } from "./components";
import { OpenAPIV3 } from "express-oas-generator";
import {
    setPathParameters,
    addTag,
    setControllerTag,
    getDefaultResponses,
    AuthenticationService
} from "@logion/rest-api-core";
import { VoteRepository, VoteAggregateRoot, Ballot, VoteResult } from "../model/vote.model.js";

type VoteView = components["schemas"]["VoteView"];
type FetchVotesResponseView = components["schemas"]["FetchVotesResponseView"];
type BallotsMap = { [key: string]: ("Yes" | "No") | undefined };

export function fillInSpec(spec: OpenAPIV3.Document): void {
    const tagName = 'Votes';
    addTag(spec, {
        name: tagName,
        description: "Handling of Legal Officer Votes"
    });
    setControllerTag(spec, /^\/api\/vote.*/, tagName);

    VoteController.fetchVotes(spec);
}

@injectable()
@Controller('/vote')
export class VoteController extends ApiController {

    constructor(
        private voteRepository: VoteRepository,
        private authenticationService: AuthenticationService,
    ) {
        super();
    }

    static fetchVotes(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/vote/{legalOfficerAddress}"].get!;
        operationObject.summary = "Lists all Legal Officer's votes";
        operationObject.description = "The authenticated user must be a LO attached to the node.";
        operationObject.responses = getDefaultResponses("FetchVotesResponseView");
        setPathParameters(operationObject, {
            legalOfficerAddress: "The address of the LO"
        });
    }

    @Async()
    @HttpGet('/:legalOfficerAddress')
    async fetchVotes(_body: never, legalOfficerAddress: string): Promise<FetchVotesResponseView> {
        const authenticatedUser = await this.authenticationService.authenticatedUserIsLegalOfficerOnNode(this.request);
        authenticatedUser.require(user => user.is(legalOfficerAddress));
        const votes = await this.voteRepository.findAll();
        return {
            votes: votes.map(vote => this.toView(vote))
        }
    }

    toView(vote: VoteAggregateRoot): VoteView {
        return {
            voteId: vote.voteId?.toString(),
            locId: vote.locId,
            createdOn: vote.createdOn?.toISOString(),
            closed: vote.closed,
            ballots: this.mapBallots(vote.ballots || []),
        }
    }

    private mapBallots(ballots: Ballot[]): BallotsMap {
        const ballotsMap: BallotsMap = {};
        for(const ballot of ballots) {
            ballotsMap[ballot.voterAddress || "?"] = ballot.result as VoteResult;
        }
        return ballotsMap;
    }
}
