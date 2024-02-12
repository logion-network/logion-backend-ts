import { It, Mock } from "moq.ts";
import { FetchLocRequestsSpecification, LocRequestAggregateRoot, LocRequestRepository } from "../../../src/logion/model/locrequest.model.js";
import { FetchProtectionRequestsSpecification, ProtectionRequestAggregateRoot, ProtectionRequestRepository } from "../../../src/logion/model/protectionrequest.model.js";
import { FetchVaultTransferRequestsSpecification, VaultTransferRequestAggregateRoot, VaultTransferRequestRepository } from "../../../src/logion/model/vaulttransferrequest.model.js";
import { WorkloadService } from "../../../src/logion/services/workload.service.js";
import { ALICE, BOB } from "../../helpers/addresses.js";

const legalOfficerAddresses = [ ALICE, BOB ];

describe("WorkloadService", () => {

    it("provides expected workload", async () => {
        const service = buildService({
            ALICE: {
                locRequests: 10,
                vaultTransferRequests: 20,
                protectionRequests: 12,
            },
            BOB: {
                locRequests: 22,
                vaultTransferRequests: 1,
                protectionRequests: 1,
            },
        });

        const workload = await service.workloadOf(legalOfficerAddresses);

        expect(workload[ALICE]).toBe(42);
        expect(workload[BOB]).toBe(24);
    });

    it("provides 0 workload if nothing pending", async () => {
        const service = buildService({
            ALICE: {
                locRequests: 0,
                vaultTransferRequests: 0,
                protectionRequests: 0,
            },
            BOB: {
                locRequests: 0,
                vaultTransferRequests: 0,
                protectionRequests: 0,
            },
        });

        const workload = await service.workloadOf(legalOfficerAddresses);

        expect(workload[ALICE]).toBe(0);
        expect(workload[BOB]).toBe(0);
    });
});

function buildService(args: Record<string, {
    locRequests: number,
    vaultTransferRequests: number,
    protectionRequests: number,
}>): WorkloadService {
    const locRequestRepository = new Mock<LocRequestRepository>();
    locRequestRepository.setup(instance => instance.findBy(
        It.Is<FetchLocRequestsSpecification>(spec => spec.expectedOwnerAddress === legalOfficerAddresses)
    )).returnsAsync(pendingLocRequests(ALICE, args.ALICE.locRequests).concat(pendingLocRequests(BOB, args.BOB.locRequests)));

    const vaultTransferRequestRepository = new Mock<VaultTransferRequestRepository>();
    vaultTransferRequestRepository.setup(instance => instance.findBy(
        It.Is<FetchVaultTransferRequestsSpecification>(spec => spec.expectedLegalOfficerAddress === legalOfficerAddresses)
    )).returnsAsync(pendingVaultTransferRequests(ALICE, args.ALICE.vaultTransferRequests).concat(pendingVaultTransferRequests(BOB, args.BOB.vaultTransferRequests)));

    const protectionRequestRepository = new Mock<ProtectionRequestRepository>();
    protectionRequestRepository.setup(instance => instance.findBy(
        It.Is<FetchProtectionRequestsSpecification>(spec => spec.expectedLegalOfficerAddress === legalOfficerAddresses)
    )).returnsAsync(pendingProtectionRequests(ALICE, args.ALICE.protectionRequests).concat(pendingProtectionRequests(BOB, args.BOB.protectionRequests)));

    return new WorkloadService(
        locRequestRepository.object(),
        vaultTransferRequestRepository.object(),
        protectionRequestRepository.object(),
    );
}

function pendingLocRequests(ownerAddress: string, length: number): LocRequestAggregateRoot[] {
    const result = [];
    for (let i = 0; i < length ; i++) {
        const request = new Mock<LocRequestAggregateRoot>()
        request.setup(instance => instance.ownerAddress).returns(ownerAddress);
        result.push(request.object());
    }
    return result;
}

function pendingVaultTransferRequests(ownerAddress: string, length: number): VaultTransferRequestAggregateRoot[] {
    const result = [];
    for (let i = 0; i < length ; i++) {
        const request = new Mock<VaultTransferRequestAggregateRoot>()
        request.setup(instance => instance.legalOfficerAddress).returns(ownerAddress);
        result.push(request.object());
    }
    return result;
}

function pendingProtectionRequests(ownerAddress: string, length: number): ProtectionRequestAggregateRoot[] {
    const result = [];
    for (let i = 0; i < length ; i++) {
        const request = new Mock<ProtectionRequestAggregateRoot>()
        request.setup(instance => instance.legalOfficerAddress).returns(ownerAddress);
        result.push(request.object());
    }
    return result;
}
