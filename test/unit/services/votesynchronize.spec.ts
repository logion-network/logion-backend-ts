import { VoteSynchronizer } from "../../../src/logion/services/votesynchronization.service.js";
import { VoteFactory, VoteAggregateRoot, VoteDescription } from "../../../src/logion/model/vote.model.js";
import { VoteService } from "../../../src/logion/services/vote.service.js";
import { Mock, It } from "moq.ts";
import { JsonExtrinsic } from "../../../src/logion/services/types/responses/Extrinsic.js";
import moment from "moment/moment.js";
import { UUID } from "@logion/node-api";

describe("VoteSynchronizer", () => {

    beforeEach(() => {
        vote = new Mock<VoteAggregateRoot>();
        voteFactory = new Mock<VoteFactory>();
        voteFactory.setup(instance => instance.newVote(It.Is<VoteDescription>(param =>
             param.locId === locIdUuid)))
            .returns(vote.object());
        voteService = new Mock<VoteService>();
        voteService.setup(instance => instance.add(vote.object()))
            .returns(Promise.resolve());
    })

    it("adds a vote", async () => {
        givenVoteExtrinsic();
        await whenConsumingBlock();
        thenVoteIsAdded();
    })
})

const blockTimestamp = moment();
const locDecimalUuid = "130084474896785895402627605545662412605";
const locId = locDecimalUuid;
const locIdUuid = UUID.fromDecimalStringOrThrow(locDecimalUuid).toString();
const voteId = "5";
let voteFactory: Mock<VoteFactory>;
let voteService: Mock<VoteService>;
let voteExtrinsic: Mock<JsonExtrinsic>;
let vote: Mock<VoteAggregateRoot>;

function givenVoteExtrinsic() {
    voteExtrinsic = new Mock<JsonExtrinsic>();
    voteExtrinsic.setup(instance => instance.call).returns({
        section: "vote",
        method: "createVoteForAllLegalOfficers",
        args: { loc_id: locId }
    })
    voteExtrinsic.setup(instance => instance.events).returns([ {
        section: "vote",
        method: "VoteCreated",
        data: [ voteId ]
    } ])
    voteExtrinsic.setup(instance => instance.error).returns(() => null);
}

async function whenConsumingBlock() {
    await voteSynchronizer().updateVotes(voteExtrinsic.object(), blockTimestamp);
}

function voteSynchronizer(): VoteSynchronizer {
    return new VoteSynchronizer(
        voteFactory.object(),
        voteService.object(),
    )
}

function thenVoteIsAdded() {
    voteService.verify(instance => instance.add(vote.object()))
}
