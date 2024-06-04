import { It, Mock } from "moq.ts";
import { FetchLocRequestsSpecification, LocRequestAggregateRoot, LocRequestRepository } from "../../../src/logion/model/locrequest.model.js";
import { FetchAccountRecoveryRequestsSpecification, AccountRecoveryRequestAggregateRoot, AccountRecoveryRepository } from "../../../src/logion/model/account_recovery.model.js";
import { FetchVaultTransferRequestsSpecification, VaultTransferRequestAggregateRoot, VaultTransferRequestRepository } from "../../../src/logion/model/vaulttransferrequest.model.js";
import { WorkloadService } from "../../../src/logion/services/workload.service.js";
import { ALICE_ACCOUNT, BOB_ACCOUNT } from "../../helpers/addresses.js";
import { ValidAccountId } from "@logion/node-api";

const legalOfficers = [ ALICE_ACCOUNT, BOB_ACCOUNT ];

describe("WorkloadService", () => {

    it("provides expected workload", async () => {
        const service = buildService({
            ALICE: {
                locRequests: 10,
                vaultTransferRequests: 20,
                accountRecoveryRequests: 12,
            },
            BOB: {
                locRequests: 22,
                vaultTransferRequests: 1,
                accountRecoveryRequests: 1,
            },
        });

        const workload = await service.workloadOf(legalOfficers);

        expect(workload[ALICE_ACCOUNT.address]).toBe(42);
        expect(workload[BOB_ACCOUNT.address]).toBe(24);
    });

    it("provides 0 workload if nothing pending", async () => {
        const service = buildService({
            ALICE: {
                locRequests: 0,
                vaultTransferRequests: 0,
                accountRecoveryRequests: 0,
            },
            BOB: {
                locRequests: 0,
                vaultTransferRequests: 0,
                accountRecoveryRequests: 0,
            },
        });

        const workload = await service.workloadOf(legalOfficers);

        expect(workload[ALICE_ACCOUNT.address]).toBe(0);
        expect(workload[BOB_ACCOUNT.address]).toBe(0);
    });
});

function buildService(args: Record<string, {
    locRequests: number,
    vaultTransferRequests: number,
    accountRecoveryRequests: number,
}>): WorkloadService {
    const locRequestRepository = new Mock<LocRequestRepository>();
    locRequestRepository.setup(instance => instance.findBy(
        It.Is<FetchLocRequestsSpecification>(spec => spec.expectedOwnerAddress !== undefined
            && spec.expectedOwnerAddress[0].equals(legalOfficers[0])
            && spec.expectedOwnerAddress[1].equals(legalOfficers[1])
        )
    )).returnsAsync(pendingLocRequests(ALICE_ACCOUNT, args.ALICE.locRequests).concat(pendingLocRequests(BOB_ACCOUNT, args.BOB.locRequests)));

    const vaultTransferRequestRepository = new Mock<VaultTransferRequestRepository>();
    vaultTransferRequestRepository.setup(instance => instance.findBy(
        It.Is<FetchVaultTransferRequestsSpecification>(spec => spec.expectedLegalOfficerAddress !== null
            && spec.expectedLegalOfficerAddress[0].equals(legalOfficers[0])
            && spec.expectedLegalOfficerAddress[1].equals(legalOfficers[1])
        )
    )).returnsAsync(pendingVaultTransferRequests(ALICE_ACCOUNT, args.ALICE.vaultTransferRequests).concat(pendingVaultTransferRequests(BOB_ACCOUNT, args.BOB.vaultTransferRequests)));

    const accountRecoveryRepository = new Mock<AccountRecoveryRepository>();
    accountRecoveryRepository.setup(instance => instance.findBy(
        It.Is<FetchAccountRecoveryRequestsSpecification>(spec => spec.expectedLegalOfficerAddress !== null
            && spec.expectedLegalOfficerAddress[0].equals(legalOfficers[0])
            && spec.expectedLegalOfficerAddress[1].equals(legalOfficers[1])
        )
    )).returnsAsync(pendingAccountRecoveryRequests(ALICE_ACCOUNT, args.ALICE.accountRecoveryRequests).concat(pendingAccountRecoveryRequests(BOB_ACCOUNT, args.BOB.accountRecoveryRequests)));

    return new WorkloadService(
        locRequestRepository.object(),
        vaultTransferRequestRepository.object(),
        accountRecoveryRepository.object(),
    );
}

function pendingLocRequests(owner: ValidAccountId, length: number): LocRequestAggregateRoot[] {
    const result = [];
    for (let i = 0; i < length ; i++) {
        const request = new Mock<LocRequestAggregateRoot>()
        request.setup(instance => instance.getOwner()).returns(owner);
        result.push(request.object());
    }
    return result;
}

function pendingVaultTransferRequests(owner: ValidAccountId, length: number): VaultTransferRequestAggregateRoot[] {
    const result = [];
    for (let i = 0; i < length ; i++) {
        const request = new Mock<VaultTransferRequestAggregateRoot>()
        request.setup(instance => instance.getLegalOfficer()).returns(owner);
        result.push(request.object());
    }
    return result;
}

function pendingAccountRecoveryRequests(owner: ValidAccountId, length: number): AccountRecoveryRequestAggregateRoot[] {
    const result = [];
    for (let i = 0; i < length ; i++) {
        const request = new Mock<AccountRecoveryRequestAggregateRoot>()
        request.setup(instance => instance.getLegalOfficer()).returns(owner);
        result.push(request.object());
    }
    return result;
}
