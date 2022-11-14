import { It, Mock } from 'moq.ts';
import {
    FetchProtectionRequestsSpecification,
    ProtectionRequestAggregateRoot,
    ProtectionRequestRepository
} from '../../../src/logion/model/protectionrequest.model';
import { JsonExtrinsic } from '../../../src/logion/services/types/responses/Extrinsic';
import { ProtectionSynchronizer } from '../../../src/logion/services/protectionsynchronization.service';
import { ALICE, BOB } from '../../helpers/addresses';

process.env.OWNER = ALICE;

describe("ProtectionSynchronizer", () => {

    beforeEach(() => {
        protectionRequestRepository = new Mock<ProtectionRequestRepository>();
    });

    it("activates protection", async () => {
        givenCreateRecoveryExtrinsic();
        givenProtectionRequest();
        await whenConsumingBlock();
        thenRequestActivated();
        thenRequestIsSaved();
    });
});

let protectionRequestRepository: Mock<ProtectionRequestRepository>;

function givenCreateRecoveryExtrinsic() {
    locExtrinsic = new Mock<JsonExtrinsic>();
    const legalOfficers = [
        ALICE,
        BOB,
    ];
    locExtrinsic.setup(instance => instance.call).returns({
        section: "verifiedRecovery",
        method: "createRecovery",
        args: { legal_officers: legalOfficers },
    });
    locExtrinsic.setup(instance => instance.signer).returns(SIGNER);
    locExtrinsic.setup(instance => instance.error).returns(() => null);
}

let locExtrinsic: Mock<JsonExtrinsic>;

function givenProtectionRequest() {
    locRequest = new Mock<ProtectionRequestAggregateRoot>();
    locRequest.setup(instance => instance.setActivated()).returns(undefined);

    protectionRequestRepository.setup(instance => instance.findBy(It.Is<FetchProtectionRequestsSpecification>(spec =>
        spec.expectedRequesterAddress === SIGNER
    ))).returns(Promise.resolve([locRequest.object()]));
    protectionRequestRepository.setup(instance => instance.save(locRequest.object())).returns(Promise.resolve());
}

const SIGNER: string = "signer";

let locRequest: Mock<ProtectionRequestAggregateRoot>;

async function whenConsumingBlock() {
    await synchronizer().updateProtectionRequests(locExtrinsic.object());
}

function synchronizer(): ProtectionSynchronizer {
    return new ProtectionSynchronizer(
        protectionRequestRepository.object(),
    );
}

function thenRequestActivated() {
    locRequest.verify(instance => instance.setActivated());
}

function thenRequestIsSaved() {
    protectionRequestRepository.verify(instance => instance.save(locRequest.object()));
}
