import { TestApp } from "@logion/rest-api-core";
import { Container } from "inversify";
import { Mock } from "moq.ts";
import request from "supertest";
import { VoteController } from "../../../src/logion/controllers/vote.controller.js";
import { VoteRepository, VoteAggregateRoot, Ballot } from "../../../src/logion/model/vote.model.js";
import { ALICE, ALICE_ACCOUNT } from "../../helpers/addresses.js";
import { DB_SS58_PREFIX } from "../../../src/logion/model/supportedaccountid.model.js";

const { setupApp } = TestApp;

const VOTE_ID = "45";
const LOC_ID = "7f236004-a5a5-491d-8b62-619f42b9fb60";
const CREATED_ON = "2021-12-31T23:00:00.000Z";

describe("VoteController", () => {

    it("fetches all votes", async () => {
        const app = setupApp(VoteController, mockForFetch)
        await request(app)
            .get(`/api/vote/${ ALICE }`)
            .send()
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .expect(response => {
                expect(response.body.votes[0].voteId).toEqual(VOTE_ID);
                expect(response.body.votes[0].locId).toEqual(LOC_ID);
                expect(response.body.votes[0].createdOn).toEqual(CREATED_ON);
                expect(response.body.votes[0].ballots[ALICE_ACCOUNT.address]).toEqual("Yes");
                expect(response.body.votes[0].status).toEqual("APPROVED");
            })
    })
})

function mockForFetch(container: Container) {
    const vote = new Mock<VoteAggregateRoot>();
    vote.setup(instance => instance.voteId).returns(VOTE_ID);
    vote.setup(instance => instance.locId).returns(LOC_ID);
    vote.setup(instance => instance.createdOn).returns(new Date(CREATED_ON));
    vote.setup(instance => instance.typeSafeStatus).returns("APPROVED");
    const ballots: Ballot[] = [];
    const ballot = new Ballot();
    ballot.vote = vote.object();
    ballot.voteId = VOTE_ID;
    ballot.voterAddress = ALICE_ACCOUNT.getAddress(DB_SS58_PREFIX);
    ballot.result = "Yes";
    ballots.push(ballot);
    vote.setup(instance => instance.ballots).returns(ballots);

    const voteRepository = new Mock<VoteRepository>();
    voteRepository.setup(instance => instance.findAll()).returns(Promise.resolve([ vote.object() ]));
    container.bind(VoteRepository).toConstantValue(voteRepository.object());
}
