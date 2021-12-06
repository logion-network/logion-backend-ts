import { It, Mock } from 'moq.ts';
import { ExtrinsicDataExtractor } from '../../../src/logion/services/extrinsic.data.extractor';
import {
    FetchProtectionRequestsSpecification,
    ProtectionRequestAggregateRoot,
    ProtectionRequestRepository
} from '../../../src/logion/model/protectionrequest.model';
import { JsonExtrinsic } from '../../../src/logion/services/types/responses/Extrinsic';
import { ProtectionSynchronizer } from '../../../src/logion/services/protectionsynchronization.service';
import { ALICE, BOB } from '../../../src/logion/model/addresses.model';

process.env.OWNER = ALICE;

describe("ProtectionSynchronizer", () => {

    beforeEach(() => {
        extrinsicDataExtractor = new Mock<ExtrinsicDataExtractor>();
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

let extrinsicDataExtractor: Mock<ExtrinsicDataExtractor>;
let protectionRequestRepository: Mock<ProtectionRequestRepository>;

function givenCreateRecoveryExtrinsic() {
    locExtrinsic = new Mock<JsonExtrinsic>();
    locExtrinsic.setup(instance => instance.method).returns({
        pallet: "verifiedRecovery",
        method: "createRecovery",
    });
    const legalOfficers = [
        {
            toString: () => ALICE
        },
        {
            toString: () => BOB
        }
    ];
    locExtrinsic.setup(instance => instance.args).returns({ legal_officers: legalOfficers });
    locExtrinsic.setup(instance => instance.signer).returns(SIGNER);
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
        extrinsicDataExtractor.object(),
        protectionRequestRepository.object(),
    );
}

function thenRequestActivated() {
    locRequest.verify(instance => instance.setActivated());
}

function thenRequestIsSaved() {
    protectionRequestRepository.verify(instance => instance.save(locRequest.object()));
}
