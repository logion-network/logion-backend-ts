import { DefaultTransactional } from "@logion/rest-api-core";
import { injectable } from "inversify";
import { TransactionAggregateRoot, TransactionRepository } from "../model/transaction.model";

export abstract class TransactionService {

    constructor(
        private transactionRepository: TransactionRepository
    ) {}

    async add(transaction: TransactionAggregateRoot) {
        await this.transactionRepository.save(transaction);
    }
}

@injectable()
export class NonTransactionalTransactionService extends TransactionService {

}

@injectable()
export class TransactionalTransactionService extends TransactionService {

    @DefaultTransactional()
    override async add(transaction: TransactionAggregateRoot) {
        await super.add(transaction);
    }
}
