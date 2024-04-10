import { TestDb } from "@logion/rest-api-core";
import { VoteRepository, VoteAggregateRoot, Ballot } from "../../../src/logion/model/vote.model.js";
import { ALICE_ACCOUNT, BOB_ACCOUNT } from "../../helpers/addresses.js";
import { DB_SS58_PREFIX } from "../../../src/logion/model/supportedaccountid.model.js";

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
        expect(vote?.status).toEqual("REJECTED");
        expect(vote?.ballots?.length).toEqual(2);
        expect(vote?.ballots?.find(ballot => ballot.voterAddress === ALICE_ACCOUNT.getAddress(DB_SS58_PREFIX) && ballot.result === "Yes")).toBeDefined();
        expect(vote?.ballots?.find(ballot => ballot.voterAddress === BOB_ACCOUNT.getAddress(DB_SS58_PREFIX) && ballot.result === "No")).toBeDefined();
    });
})
