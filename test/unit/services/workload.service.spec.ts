import { It, Mock } from "moq.ts";
import { FetchLocRequestsSpecification, LocRequestAggregateRoot, LocRequestRepository } from "../../../src/logion/model/locrequest.model.js";
import { FetchProtectionRequestsSpecification, ProtectionRequestAggregateRoot, ProtectionRequestRepository } from "../../../src/logion/model/protectionrequest.model.js";
import { FetchVaultTransferRequestsSpecification, VaultTransferRequestAggregateRoot, VaultTransferRequestRepository } from "../../../src/logion/model/vaulttransferrequest.model.js";
import { WorkloadService } from "../../../src/logion/services/workload.service.js";
import { ALICE } from "../../helpers/addresses.js";

describe("WorkloadService", () => {

    it("provides expected workload", async () => {
        const legalOfficerAddress = ALICE;
        const service = buildService({
            legalOfficerAddress,
            locRequests: 10,
            vaultTransferRequests: 20,
            protectionRequests: 12,
        });

        const workload = await service.workloadOf(legalOfficerAddress);

        expect(workload).toBe(42);
    });

    it("provides 0 workload if nothing pending", async () => {
        const legalOfficerAddress = ALICE;
        const service = buildService({
            legalOfficerAddress,
            locRequests: 0,
            vaultTransferRequests: 0,
            protectionRequests: 0,
        });

        const workload = await service.workloadOf(legalOfficerAddress);

        expect(workload).toBe(0);
    });
});

function buildService(args: {
    legalOfficerAddress: string,
    locRequests: number,
    vaultTransferRequests: number,
    protectionRequests: number,
}): WorkloadService {
    const locRequestRepository = new Mock<LocRequestRepository>();
    locRequestRepository.setup(instance => instance.findBy(
        It.Is<FetchLocRequestsSpecification>(spec => spec.expectedOwnerAddress === args.legalOfficerAddress)
    )).returnsAsync(pendingLocRequests(args.locRequests));

    const vaultTransferRequestRepository = new Mock<VaultTransferRequestRepository>();
    vaultTransferRequestRepository.setup(instance => instance.findBy(
        It.Is<FetchVaultTransferRequestsSpecification>(spec => spec.expectedLegalOfficerAddress === args.legalOfficerAddress)
    )).returnsAsync(pendingVaultTransferRequests(args.vaultTransferRequests));

    const protectionRequestRepository = new Mock<ProtectionRequestRepository>();
    protectionRequestRepository.setup(instance => instance.findBy(
        It.Is<FetchProtectionRequestsSpecification>(spec => spec.expectedLegalOfficerAddress === args.legalOfficerAddress)
    )).returnsAsync(pendingProtectionRequests(args.protectionRequests));

    return new WorkloadService(
        locRequestRepository.object(),
        vaultTransferRequestRepository.object(),
        protectionRequestRepository.object(),
    );
}

function pendingLocRequests(length: number): LocRequestAggregateRoot[] {
    return new Array(length);
}

function pendingVaultTransferRequests(length: number): VaultTransferRequestAggregateRoot[] {
    return new Array(length);
}

function pendingProtectionRequests(length: number): ProtectionRequestAggregateRoot[] {
    return new Array(length);
}
