import { injectable } from "inversify";
import { LocRequestRepository } from "../model/locrequest.model.js";
import { FetchVaultTransferRequestsSpecification, VaultTransferRequestRepository } from "../model/vaulttransferrequest.model.js";
import { FetchProtectionRequestsSpecification, ProtectionRequestRepository } from "../model/protectionrequest.model.js";
import { ValidAccountId } from "@logion/node-api";

@injectable()
export class WorkloadService {

    constructor(
        private locRequestRepository: LocRequestRepository,
        private vaultTransferRequestRepository: VaultTransferRequestRepository,
        private protectionRequestRepository: ProtectionRequestRepository,
    ) {
    }

    async workloadOf(addresses: ValidAccountId[]): Promise<Record<string, number>> {
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
        return addresses.reduce((map, account) => {
            map[account.address] = pendingLocRequests.filter(request => request.getOwner().equals(account)).length
                + pendingVaultTransferRequests.filter(request => request.getLegalOfficer().equals(account)).length
                + pendingProtectionRequests.filter(request => request.getLegalOfficer().equals(account)).length;
            return map;
        }, {} as Record<string, number>);
    }
}
