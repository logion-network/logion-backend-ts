import { DefaultTransactional, requireDefined } from "@logion/rest-api-core";
import { injectable } from "inversify";
import { AccountRecoveryRequestAggregateRoot, AccountRecoveryRepository } from "../model/account_recovery.model.js";

export abstract class AccountRecoveryRequestService {

    protected constructor(
        private accountRecoveryRepository: AccountRecoveryRepository,
    ) {}

    async add(request: AccountRecoveryRequestAggregateRoot) {
        await this.accountRecoveryRepository.save(request);
    }

    async update(id: string, mutator: (request: AccountRecoveryRequestAggregateRoot) => Promise<void>) {
        const request = requireDefined(await this.accountRecoveryRepository.findById(id));
        await mutator(request);
        await this.accountRecoveryRepository.save(request);
        return request;
    }
}

@injectable()
export class NonTransactionalAccountRecoveryRequestService extends AccountRecoveryRequestService {

    constructor(
        accountRecoveryRepository: AccountRecoveryRepository,
    ) {
        super(accountRecoveryRepository);
    }
}

@injectable()
export class TransactionalAccountRecoveryRequestService extends AccountRecoveryRequestService {

    constructor(
        accountRecoveryRepository: AccountRecoveryRepository,
    ) {
        super(accountRecoveryRepository);
    }

    @DefaultTransactional()
    override async add(request: AccountRecoveryRequestAggregateRoot) {
        return super.add(request);
    }

    @DefaultTransactional()
    override async update(id: string, mutator: (request: AccountRecoveryRequestAggregateRoot) => Promise<void>) {
        return super.update(id, mutator);
    }
}
