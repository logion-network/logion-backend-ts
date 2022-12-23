import { Moment } from "moment/moment";
import { Log } from "@logion/rest-api-core";
import { injectable } from "inversify";
import { VoteFactory } from "../model/vote.model.js";
import { VoteService } from "./vote.service.js";
import { JsonExtrinsic, toString, extractLocId, findEventData } from "./types/responses/Extrinsic.js";

const { logger } = Log;

@injectable()
export class VoteSynchronizer {

    constructor(
        private voteFactory: VoteFactory,
        private voteService: VoteService,
    ) {
    }

    async updateVotes(extrinsic: JsonExtrinsic, timestamp: Moment): Promise<void> {
        if (extrinsic.call.section !== "vote") {
            return
        }
        const error = extrinsic.error();
        if (error) {
            logger.info("updateVotes() - Skipping extrinsic with error: %s", toString(extrinsic, error))
            return
        }
        if (extrinsic.call.method === "createVoteForAllLegalOfficers") {
            const locId = extractLocId('loc_id', extrinsic.call.args);
            const voteId = this.extractVoteId(extrinsic);
            logger.info("Creating vote %s for LOC %s", voteId, locId);
            const vote = this.voteFactory.newVote({
                voteId,
                locId,
                createdOn: timestamp
            });
            await this.voteService.add(vote);
        }
    }

    private extractVoteId(extrinsic: JsonExtrinsic): string {
        const data = findEventData(extrinsic, { pallet: "vote", method: "VoteCreated" });
        if (data === undefined || data.length < 1) {
            throw Error("Failed to find voteId in event");
        } else {
            return data[0].toString();
        }
    }
}
