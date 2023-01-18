import { TestDb } from "@logion/rest-api-core";
import { ALICE, BOB } from "@logion/rest-api-core/dist/TestApp.js";
import { VoteRepository, VoteAggregateRoot, Ballot } from "../../../src/logion/model/vote.model.js";

const { connect, disconnect, executeScript } = TestDb;

describe("VoteRepository", () => {

    let repository:VoteRepository;

    beforeAll(async () => {
        await connect([ VoteAggregateRoot, Ballot ]);
        await executeScript("test/integration/model/votes.sql");
        repository = new VoteRepository();
    });

    afterAll(async () => {
        await disconnect();
    });

    it("finds all votes", async () => {
        const votes = await repository.findAll();
        expect(votes.length).toEqual(2);
    });

    it("find vote by loc id", async () => {
        const locId = "c744db7c-181d-42d7-adc3-781e9fc4210f";
        const vote = await repository.findByLocId(locId);
        expect(vote?.voteId).toEqual('1');
        expect(vote?.locId).toEqual(locId);
        expect(vote?.createdOn?.toISOString()).toEqual("2022-09-30T22:00:00.000Z")
        expect(vote?.closed).toEqual(true);
        expect(vote?.ballots?.length).toEqual(2);
        expect(vote?.ballots?.find(ballot => ballot.voterAddress === ALICE && ballot.result === "Yes")).toBeDefined();
        expect(vote?.ballots?.find(ballot => ballot.voterAddress === BOB && ballot.result === "No")).toBeDefined();
    });
})
