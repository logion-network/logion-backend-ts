import { It, Mock } from 'moq.ts';
import {
    FetchAccountRecoveryRequestsSpecification,
    AccountRecoveryRequestAggregateRoot,
    AccountRecoveryRepository
} from '../../../src/logion/model/account_recovery.model.js';
import { JsonExtrinsic } from '../../../src/logion/services/types/responses/Extrinsic.js';
import { AccountRecoverySynchronizer } from '../../../src/logion/services/accountrecoverysynchronization.service.js';
import { BOB_ACCOUNT, ALICE_ACCOUNT } from '../../helpers/addresses.js';
import { NonTransactionalAccountRecoveryRequestService } from '../../../src/logion/services/accountrecoveryrequest.service.js';
import { LegalOfficerService } from "../../../src/logion/services/legalOfficerService.js";
import { ValidAccountId } from "@logion/node-api";

describe("AccountRecoverySynchronizer", () => {

    beforeEach(() => {
        protectionRequestRepository = new Mock<AccountRecoveryRepository>();
    });

    it("activates protection", async () => {
        givenCreateRecoveryExtrinsic();
        givenProtectionRequest();
        await whenConsumingBlock();
        thenRequestActivated();
        thenRequestIsSaved();
    });
});

let protectionRequestRepository: Mock<AccountRecoveryRepository>;
let legalOfficerService: Mock<LegalOfficerService>;

function givenCreateRecoveryExtrinsic() {
    locExtrinsic = new Mock<JsonExtrinsic>();
    const legalOfficers = [
        ALICE_ACCOUNT.address,
        BOB_ACCOUNT.address,
    ];
    locExtrinsic.setup(instance => instance.call).returns({
        section: "verifiedRecovery",
        method: "createRecovery",
        args: { legal_officers: legalOfficers },
    });
    locExtrinsic.setup(instance => instance.signer).returns(SIGNER.address);
    locExtrinsic.setup(instance => instance.error).returns(() => null);
}

let locExtrinsic: Mock<JsonExtrinsic>;

function givenProtectionRequest() {
    locRequest = new Mock<AccountRecoveryRequestAggregateRoot>();
    const requestId = "12588da8-e1fe-4a7a-aa1d-bb170c3608df";
    locRequest.setup(instance => instance.id).returns(requestId);
    locRequest.setup(instance => instance.setActivated()).returns(undefined);

    protectionRequestRepository.setup(instance => instance.findBy(It.Is<FetchAccountRecoveryRequestsSpecification>(spec =>
        spec.expectedRequesterAddress !== null && spec.expectedRequesterAddress.equals(SIGNER)
    ))).returns(Promise.resolve([locRequest.object()]));
    protectionRequestRepository.setup(instance => instance.findById(requestId)).returns(Promise.resolve(locRequest.object()));
    protectionRequestRepository.setup(instance => instance.save(locRequest.object())).returns(Promise.resolve());

    legalOfficerService = new Mock<LegalOfficerService>();
    legalOfficerService.setup(instance => instance.isLegalOfficerAddressOnNode)
        .returns(account => Promise.resolve(account.equals(ALICE_ACCOUNT)));
}

const SIGNER = ValidAccountId.polkadot("5Dy3sY9AemJL9WmLzCEDDbRGpegzRWemKtRKDRAhxWzni3Nr")

let locRequest: Mock<AccountRecoveryRequestAggregateRoot>;

async function whenConsumingBlock() {
    await synchronizer().updateAccountRecoveryRequests(locExtrinsic.object());
}

function synchronizer(): AccountRecoverySynchronizer {
    return new AccountRecoverySynchronizer(
        protectionRequestRepository.object(),
        new NonTransactionalAccountRecoveryRequestService(protectionRequestRepository.object()),
        legalOfficerService.object(),
    );
}

function thenRequestActivated() {
    locRequest.verify(instance => instance.setActivated());
}

function thenRequestIsSaved() {
    protectionRequestRepository.verify(instance => instance.save(locRequest.object()));
}
