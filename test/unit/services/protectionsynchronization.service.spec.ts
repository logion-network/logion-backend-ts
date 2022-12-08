import { It, Mock } from 'moq.ts';
import {
    FetchProtectionRequestsSpecification,
    ProtectionRequestAggregateRoot,
    ProtectionRequestRepository
} from '../../../src/logion/model/protectionrequest.model';
import { JsonExtrinsic } from '../../../src/logion/services/types/responses/Extrinsic';
import { ProtectionSynchronizer } from '../../../src/logion/services/protectionsynchronization.service';
import { ALICE, BOB } from '../../helpers/addresses';
import { NonTransactionalProtectionRequestService } from '../../../src/logion/services/protectionrequest.service';
import { DirectoryService } from "../../../src/logion/services/directory.service";

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
let directoryService: Mock<DirectoryService>;

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
    const requestId = "12588da8-e1fe-4a7a-aa1d-bb170c3608df";
    locRequest.setup(instance => instance.id).returns(requestId);
    locRequest.setup(instance => instance.setActivated()).returns(undefined);

    protectionRequestRepository.setup(instance => instance.findBy(It.Is<FetchProtectionRequestsSpecification>(spec =>
        spec.expectedRequesterAddress === SIGNER
    ))).returns(Promise.resolve([locRequest.object()]));
    protectionRequestRepository.setup(instance => instance.findById(requestId)).returns(Promise.resolve(locRequest.object()));
    protectionRequestRepository.setup(instance => instance.save(locRequest.object())).returns(Promise.resolve());

    directoryService = new Mock<DirectoryService>();
    directoryService.setup(instance => instance.isLegalOfficerAddressOnNode)
        .returns((address: string) => Promise.resolve(address === ALICE));
}

const SIGNER: string = "signer";

let locRequest: Mock<ProtectionRequestAggregateRoot>;

async function whenConsumingBlock() {
    await synchronizer().updateProtectionRequests(locExtrinsic.object());
}

function synchronizer(): ProtectionSynchronizer {
    return new ProtectionSynchronizer(
        protectionRequestRepository.object(),
        new NonTransactionalProtectionRequestService(protectionRequestRepository.object()),
        directoryService.object(),
    );
}

function thenRequestActivated() {
    locRequest.verify(instance => instance.setActivated());
}

function thenRequestIsSaved() {
    protectionRequestRepository.verify(instance => instance.save(locRequest.object()));
}
