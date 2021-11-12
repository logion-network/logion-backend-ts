import { injectable } from "inversify";
import { TransactionAggregateRoot, TransactionRepository, TransactionFactory, TransactionDescription } from "../model/transaction.model";
import { TransactionExtractor } from "./transaction.extractor";
import { BlockWithTransactions, Transaction } from './transaction.vo';
import { BlockExtrinsics } from "./types/responses/Block";

@injectable()
export class TransactionSynchronizer {

    constructor(
        private transactionRepository: TransactionRepository,
        private transactionFactory: TransactionFactory,
        private transactionExtractor: TransactionExtractor,
    ) {}

    async addTransactions(block: BlockExtrinsics): Promise<void> {
        const blockWithTransactions = this.transactionExtractor.extractBlockWithTransactions(block);
        if (blockWithTransactions === undefined) {
            return;
        }
        for(let i = 0; i < blockWithTransactions.transactions.length; ++i) {
            const transaction = blockWithTransactions.transactions[i];
            const aggregate = this.toEntity(blockWithTransactions, transaction);
            await this.transactionRepository.save(aggregate);
        }
    }

    private toEntity(blockWithTransactions: BlockWithTransactions, transaction: Transaction): TransactionAggregateRoot {
        const createdOn = blockWithTransactions.timestamp!.toISOString();
        let description: TransactionDescription = {
            ...transaction,
            createdOn
        };
        return this.transactionFactory.newTransaction({
            blockNumber: blockWithTransactions.blockNumber!,
            extrinsicIndex: transaction.extrinsicIndex,
            description
        });
    }

    async reset() {
        await this.transactionRepository.deleteAll();
    }
}
