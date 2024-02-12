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

    async workloadOf(addresses: string[]): Promise<Record<string, number>> {
        const pendingLocRequests = await this.locRequestRepository.findBy({
            expectedOwnerAddress: addresses,
            expectedStatuses: [ "REVIEW_PENDING" ],
        });
        const pendingVaultTransferRequests = await this.vaultTransferRequestRepository.findBy(new FetchVaultTransferRequestsSpecification({
            expectedLegalOfficerAddress: addresses,
            expectedStatuses: [ "PENDING" ],
        }));
        const pendingProtectionRequests = await this.protectionRequestRepository.findBy(new FetchProtectionRequestsSpecification({
            expectedLegalOfficerAddress: addresses,
            expectedStatuses: [ "PENDING" ],
        }));
        return addresses.reduce((map, address) => {
            map[address] = pendingLocRequests.filter(request => request.ownerAddress === address).length
                + pendingVaultTransferRequests.filter(request => request.legalOfficerAddress === address).length
                + pendingProtectionRequests.filter(request => request.legalOfficerAddress === address).length;
            return map;
        }, {} as Record<string, number>);
    }
}
