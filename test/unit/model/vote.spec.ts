import { ALICE, BOB } from "@logion/rest-api-core/dist/TestApp.js";
import moment from "moment";
import { VoteAggregateRoot, VoteFactory } from "../../../src/logion/model/vote.model.js";

describe("VoteFactory", () => {

    it("creates pending vote", () => {
        const vote = buildPendingVote();
        expect(vote.ballots?.length).toBe(0);
        expect(vote.typeSafeStatus).toBe("PENDING");
    });
});

function buildPendingVote(): VoteAggregateRoot {
    const factory = new VoteFactory();
    return factory.newVote({
        voteId: "1",
        locId: "fd61e638-4af0-4ced-b018-4f1c31a91e6e",
        createdOn: moment(),
    });
}

describe("VoteAggregateRoot", () => {

    it("accepts ballots", () => {
        const vote = buildPendingVote();
        vote.addBallot(ALICE, "Yes");
        vote.addBallot(BOB, "No");
        expect(vote.ballots?.length).toBe(2);

        expect(vote.ballots![0].vote).toBe(vote);
        expect(vote.ballots![0].voteId).toBe(vote.voteId);
        expect(vote.ballots![0].voterAddress).toBe(ALICE);
        expect(vote.ballots![0].result).toBe("Yes");

        expect(vote.ballots![1].vote).toBe(vote);
        expect(vote.ballots![1].voteId).toBe(vote.voteId);
        expect(vote.ballots![1].voterAddress).toBe(BOB);
        expect(vote.ballots![1].result).toBe("No");
    });

    it("can be approved", () => {
        const vote = buildPendingVote();
        vote.close(true);
        expect(vote.typeSafeStatus).toBe("APPROVED");
    });

    it("can be rejected", () => {
        const vote = buildPendingVote();
        vote.close(false);
        expect(vote.typeSafeStatus).toBe("REJECTED");
    });

    it("cannot be closed more than once", () => {
        const vote = buildPendingVote();
        vote.close(true);
        expect(() => vote.close(true)).toThrowError("Vote is already closed");
    });
});
