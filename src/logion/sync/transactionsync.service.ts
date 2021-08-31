import { injectable } from "inversify";
import { Moment } from "moment";
import { SyncPointFactory, SyncPointRepository, TRANSACTIONS_SYNC_POINT_NAME } from "../model/syncpoint.model";
import { TransactionAggregateRoot, TransactionRepository, TransactionFactory, TransactionDescription } from "../model/transaction.model";
import { BlockExtrinsicsService } from "../services/block.service";
import { Log } from "../util/Log";
import { TransactionExtractor } from "./transaction.extractor";
import { BlockWithTransactions, Transaction } from './transaction.vo';

const { logger } = Log;

@injectable()
export class TransactionSync {

    constructor(
        private blockService: BlockExtrinsicsService,
        private transactionRepository: TransactionRepository,
        private transactionFactory: TransactionFactory,
        private transactionExtractor: TransactionExtractor,
        private syncPointRepository: SyncPointRepository,
        private syncPointFactory: SyncPointFactory,
    ) {}

    async syncTransactions(now: Moment): Promise<void> {
        const head = await this.blockService.getHeadBlockNumber();
        let lastSyncPoint = await this.syncPointRepository.findByName(TRANSACTIONS_SYNC_POINT_NAME);
        let lastSynced = lastSyncPoint !== undefined ? BigInt(lastSyncPoint.latestHeadBlockNumber!) : 0n;
        if (lastSynced === head.valueOf()) {
            return;
        }

        if (lastSynced > head) {
            logger.warn("Out-of-sync error: last synced block number greater than head number. Transaction cache will be erased and rebuilt from block #1");
            await this.transactionRepository.deleteAll();
            await this.syncPointRepository.delete(lastSyncPoint!);
            lastSynced = 0n;
            lastSyncPoint = undefined;
        }

        for (let blockNumber: bigint = lastSynced + 1n; blockNumber <= head; blockNumber++) {
            if ((blockNumber % 1000n) === 0n) {
                logger.debug("Scanning block {}/{}", blockNumber, head);
            }
            await this.processBlock(blockNumber);
        }

        if(lastSyncPoint === undefined) {
            lastSyncPoint = this.syncPointFactory.newSyncPoint({
                name: TRANSACTIONS_SYNC_POINT_NAME,
                latestHeadBlockNumber: head,
                createdOn: now
            });
        } else {
            lastSyncPoint.update({
                blockNumber: head,
                updatedOn: now
            });
        }
        this.syncPointRepository.save(lastSyncPoint);
    }

    private async processBlock(blockNumber: bigint): Promise<void> {
        const block = await this.blockService.getBlockExtrinsics(blockNumber);
        const blockWithTransactions = this.transactionExtractor.extractBlockWithTransactions(block);
        if (blockWithTransactions !== undefined) {
            await this.addTransactions(blockWithTransactions);
        }
    }

    private async addTransactions(blockWithTransactions: BlockWithTransactions): Promise<void> {
        for(let i = 0; i < blockWithTransactions.transactions.length; ++i) {
            const transaction = blockWithTransactions.transactions[i];
            const aggregate = this.toEntity(blockWithTransactions, transaction);
            await this.transactionRepository.save(aggregate);
        }
    }

    private toEntity(blockWithTransactions: BlockWithTransactions, transaction: Transaction): TransactionAggregateRoot {
        const createdOn = blockWithTransactions.timestamp!.toISOString();
        var description: TransactionDescription = {
            ...transaction,
            createdOn
        };
        return this.transactionFactory.newTransaction({
            blockNumber: blockWithTransactions.blockNumber!,
            extrinsicIndex: transaction.extrinsicIndex,
            description
        });
    }
}
