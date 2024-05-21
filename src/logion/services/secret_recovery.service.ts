import {
    SecretRecoveryRequestRepository,
    SecretRecoveryRequestAggregateRoot
} from "../model/secret_recovery.model.js";
import { DefaultTransactional } from "@logion/rest-api-core";
import { injectable } from "inversify";

export abstract class SecretRecoveryRequestService {

    protected constructor(
        private secretRecoveryRequestRepository: SecretRecoveryRequestRepository,
    ) {
    }

    async add(request: SecretRecoveryRequestAggregateRoot) {
        await this.secretRecoveryRequestRepository.save(request);
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
}

@injectable()
export class NonTransactionalSecretRecoveryRequestService extends SecretRecoveryRequestService {

    constructor(
        secretRecoveryRequestRepository: SecretRecoveryRequestRepository,
    ) {
        super(secretRecoveryRequestRepository);
    }
}
