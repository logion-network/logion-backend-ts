import { injectable } from "inversify";
import { LocRequestRepository } from "../model/locrequest.model.js";
import { FetchVaultTransferRequestsSpecification, VaultTransferRequestRepository } from "../model/vaulttransferrequest.model.js";
import { FetchProtectionRequestsSpecification, ProtectionRequestRepository } from "../model/protectionrequest.model.js";

@injectable()
export class WorkloadService {

    constructor(
        private locRequestRepository: LocRequestRepository,
        private vaultTransferRequestRepository: VaultTransferRequestRepository,
        private protectionRequestRepository: ProtectionRequestRepository,
    ) {
    }

    async workloadOf(address: string): Promise<number> {
        const pendingLocRequests = await this.locRequestRepository.findBy({
            expectedOwnerAddress: address,
            expectedStatuses: [ "REVIEW_PENDING" ],
        });
        const pendingVaultTransferRequests = await this.vaultTransferRequestRepository.findBy(new FetchVaultTransferRequestsSpecification({
            expectedLegalOfficerAddress: address,
            expectedStatuses: [ "PENDING" ],
        }));
        const pendingProtectionRequests = await this.protectionRequestRepository.findBy(new FetchProtectionRequestsSpecification({
            expectedLegalOfficerAddress: address,
            expectedStatuses: [ "PENDING" ],
        }));
        return pendingLocRequests.length + pendingVaultTransferRequests.length + pendingProtectionRequests.length;
    }
}
