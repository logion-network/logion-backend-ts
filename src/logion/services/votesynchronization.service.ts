import { Moment } from "moment/moment";
import { Log } from "@logion/rest-api-core";
import { injectable } from "inversify";
import { VoteFactory } from "../model/vote.model.js";
import { VoteService } from "./vote.service.js";
import { JsonExtrinsic, toString, extractUuid, findEventData } from "./types/responses/Extrinsic.js";
import { asJsonObject, asString } from "@logion/node-api";

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
            return;
        }
        const error = extrinsic.error();
        if (error) {
            logger.info("updateVotes() - Skipping extrinsic with error: %s", toString(extrinsic, error));
            return;
        }
        if (extrinsic.call.method === "createVoteForAllLegalOfficers") {
            await this.addVote(extrinsic, timestamp);
        } else if (extrinsic.call.method === "vote") {
            await this.updateVote(extrinsic);
        }
    }

    private async addVote(extrinsic: JsonExtrinsic, timestamp: Moment) {
        const locId = extractUuid('loc_id', extrinsic.call.args);
        const voteId = this.extractVoteId(extrinsic);
        logger.info("Creating vote %s for LOC %s", voteId, locId);
        const vote = this.voteFactory.newVote({
            voteId,
            locId,
            createdOn: timestamp
        });
        await this.voteService.add(vote);
    }

    private extractVoteId(extrinsic: JsonExtrinsic): string {
        const data = findEventData(extrinsic, { pallet: "vote", method: "VoteCreated" });
        if (data === undefined || data.length < 1) {
            throw Error("Failed to find voteId in event");
        } else {
            return data[0].toString();
        }
    }

    private async updateVote(extrinsic: JsonExtrinsic) {
        const data = findEventData(extrinsic, { pallet: "vote", method: "VoteUpdated" });
        if (data === undefined || data.length < 4) {
            throw new Error("Failed to extract VoteUpdated event data");
        } else {
            const voteId = data[0].toString();
            const ballot = asJsonObject(data[1].toJSON());
            const closed = data[2].isTrue;
            const approved = data[3].isTrue;

            const voter = asString(ballot.voter);
            const result = asString(ballot.status);
            logger.info(`Adding ballot for voter ${voter} to vote ${voteId}`);
            await this.voteService.update(voteId, async vote => {
                vote.addBallot(voter, result === "VotedYes" ? "Yes" : "No");
                if(closed) {
                    logger.info(`Closing vote ${voteId}`);
                    vote.close(approved);
                }
            });
        }
    }
}
