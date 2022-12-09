import { DefaultTransactional, requireDefined } from "@logion/rest-api-core";
import { injectable } from "inversify";
import { VaultTransferRequestAggregateRoot, VaultTransferRequestRepository } from "../model/vaulttransferrequest.model.js";

export abstract class VaultTransferRequestService {

    constructor(
        private vaultTransferRequestRepository: VaultTransferRequestRepository,
    ) {}

    async add(vaultTransferRequest: VaultTransferRequestAggregateRoot) {
        await this.vaultTransferRequestRepository.save(vaultTransferRequest);
    }

    async update(id: string, mutator: (vaultTransferRequest: VaultTransferRequestAggregateRoot) => Promise<void>) {
        const vaultTransferRequest = requireDefined(await this.vaultTransferRequestRepository.findById(id));
        await mutator(vaultTransferRequest);
        await this.vaultTransferRequestRepository.save(vaultTransferRequest);
        return vaultTransferRequest;
    }
}

@injectable()
export class NonTransactionalVaultTransferRequestService extends VaultTransferRequestService {

    constructor(
        vaultTransferRequestRepository: VaultTransferRequestRepository,
    ) {
        super(vaultTransferRequestRepository);
    }
}

@injectable()
export class TransactionalVaultTransferRequestService extends VaultTransferRequestService {

    constructor(
        vaultTransferRequestRepository: VaultTransferRequestRepository,
    ) {
        super(vaultTransferRequestRepository);
    }

    @DefaultTransactional()
    override async add(vaultTransferRequest: VaultTransferRequestAggregateRoot) {
        return super.add(vaultTransferRequest);
    }

    @DefaultTransactional()
    override async update(id: string, mutator: (vaultTransferRequest: VaultTransferRequestAggregateRoot) => Promise<void>) {
        return super.update(id, mutator);
    }
}
