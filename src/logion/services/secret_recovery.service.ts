import {
    SecretRecoveryRequestRepository,
    SecretRecoveryRequestAggregateRoot
} from "../model/secret_recovery.model.js";
import { DefaultTransactional, requireDefined } from "@logion/rest-api-core";
import { injectable } from "inversify";

export abstract class SecretRecoveryRequestService {

    protected constructor(
        private secretRecoveryRequestRepository: SecretRecoveryRequestRepository,
    ) {
    }

    async add(request: SecretRecoveryRequestAggregateRoot) {
        await this.secretRecoveryRequestRepository.save(request);
    }

    async update(id: string, mutator: (item: SecretRecoveryRequestAggregateRoot) => Promise<void>): Promise<SecretRecoveryRequestAggregateRoot> {
        const item = requireDefined(await this.secretRecoveryRequestRepository.findById(id));
        await mutator(item);
        await this.secretRecoveryRequestRepository.save(item);
        return item;
    }
}

@injectable()
export class TransactionalSecretRecoveryRequestService extends SecretRecoveryRequestService {

    constructor(
        secretRecoveryRequestRepository: SecretRecoveryRequestRepository,
    ) {
        super(secretRecoveryRequestRepository);
    }

    @DefaultTransactional()
    override async add(request: SecretRecoveryRequestAggregateRoot): Promise<void> {
        return super.add(request);
    }

    @DefaultTransactional()
    override update(id: string, mutator: (item: SecretRecoveryRequestAggregateRoot) => Promise<void>): Promise<SecretRecoveryRequestAggregateRoot> {
        return super.update(id, mutator);
    }
}

@injectable()
export class NonTransactionalSecretRecoveryRequestService extends SecretRecoveryRequestService {

    constructor(
        secretRecoveryRequestRepository: SecretRecoveryRequestRepository,
    ) {
        super(secretRecoveryRequestRepository);
    }
}
