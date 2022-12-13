import { injectable } from "inversify";
import { v4 as uuid } from 'uuid';
import { TransactionAggregateRoot, TransactionFactory, TransactionDescription } from "../model/transaction.model.js";
import { TransactionExtractor } from "./transaction.extractor.js";
import { TransactionService } from "./transaction.service.js";
import { BlockWithTransactions, Transaction } from './transaction.vo.js';
import { BlockExtrinsics } from "./types/responses/Block.js";

@injectable()
export class TransactionSynchronizer {

    constructor(
        private transactionFactory: TransactionFactory,
        private transactionExtractor: TransactionExtractor,
        private transactionService: TransactionService,
    ) {}

    async addTransactions(block: BlockExtrinsics): Promise<void> {
        const blockWithTransactions = await this.transactionExtractor.extractBlockWithTransactions(block);
        if (blockWithTransactions === undefined) {
            return;
        }
        for(let i = 0; i < blockWithTransactions.transactions.length; ++i) {
            const transaction = blockWithTransactions.transactions[i];
            const aggregate = this.toEntity(blockWithTransactions, transaction);
            await this.transactionService.add(aggregate);
        }
    }

    private toEntity(blockWithTransactions: BlockWithTransactions, transaction: Transaction): TransactionAggregateRoot {
        const createdOn = blockWithTransactions.timestamp!.toISOString();
        let description: TransactionDescription = {
            ...transaction,
            id: uuid(),
            blockNumber: blockWithTransactions.blockNumber!,
            createdOn,
        };
        return this.transactionFactory.newTransaction(description);
    }
}
