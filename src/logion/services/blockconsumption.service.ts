import { injectable } from "inversify";
import { Moment } from "moment";
import { SyncPointAggregateRoot, SyncPointFactory, SyncPointRepository, TRANSACTIONS_SYNC_POINT_NAME } from "../model/syncpoint.model";
import { BlockExtrinsicsService } from "./block.service";
import { LocSynchronizer } from "./locsynchronization.service";
import { Log } from "../util/Log";
import { TransactionSynchronizer } from "./transactionsync.service";
import { ProtectionSynchronizer } from "./protectionsynchronization.service";
import { ExtrinsicDataExtractor } from "./extrinsic.data.extractor";
import { toString } from "./types/responses/Extrinsic";

const { logger } = Log;

const PROCESSED_BLOCKS_SINCE_LAST_SYNC_THRESHOLD = 1000;
const BATCH_SIZE = 20000n;

@injectable()
export class BlockConsumer {

    constructor(
        private blockService: BlockExtrinsicsService,
        private syncPointRepository: SyncPointRepository,
        private syncPointFactory: SyncPointFactory,
        private transactionSynchronizer: TransactionSynchronizer,
        private locSynchronizer: LocSynchronizer,
        private protectionSynchronizer: ProtectionSynchronizer,
        private extrinsicDataExtractor: ExtrinsicDataExtractor,
    ) {}

    async consumeNewBlocks(now: Moment): Promise<void> {
        const head = await this.blockService.getHeadBlockNumber();
        let lastSyncPoint = await this.syncPointRepository.findByName(TRANSACTIONS_SYNC_POINT_NAME);
        let lastSynced = lastSyncPoint !== undefined ? BigInt(lastSyncPoint.latestHeadBlockNumber!) : 0n;
        if (lastSynced === head.valueOf()) {
            return;
        }

        if (lastSynced > head) {
            logger.warn("Out-of-sync error: last synced block number greater than head number. Transaction cache will be erased and rebuilt from block #1");

            await this.transactionSynchronizer.reset();

            await this.syncPointRepository.delete(lastSyncPoint!);
            lastSynced = 0n;
            lastSyncPoint = undefined;
        }

        let totalProcessedBlocks: bigint = 0n;
        let processedBlocksSinceLastSync = 0;
        let blockNumber: bigint = lastSynced + 1n
        while (blockNumber <= head && totalProcessedBlocks < BATCH_SIZE) {
            this.logProgress(blockNumber, head);
            await this.processBlock(blockNumber);
            ++processedBlocksSinceLastSync;
            ++totalProcessedBlocks;

            if(processedBlocksSinceLastSync === PROCESSED_BLOCKS_SINCE_LAST_SYNC_THRESHOLD) {
                processedBlocksSinceLastSync = 0;
                lastSyncPoint = await this.sync(lastSyncPoint, now, blockNumber);
                lastSynced = blockNumber;
            }

            blockNumber++;
        }

        if(lastSynced < (blockNumber - 1n)) {
            await this.sync(lastSyncPoint, now, blockNumber - 1n);
        }

        if(blockNumber < head) {
            logger.info(`Batch size reached (${BATCH_SIZE}), stopping; sync will resume in a couple of seconds`);
        }
    }

    private logProgress(blockNumber: bigint, head: bigint) {
        logger.debug("Scanning block %d/%d", blockNumber, head);
        if(!logger.isDebugEnabled() && logger.isInfoEnabled() && (blockNumber % 1000n) === 0n) {
            logger.info("Scanning block %d/%d", blockNumber, head);
        }
    }

    private async processBlock(blockNumber: bigint): Promise<void> {
        const block = await this.blockService.getBlockExtrinsics(blockNumber);
        const timestamp = this.extrinsicDataExtractor.getBlockTimestamp(block);
        if (timestamp === undefined) {
            throw Error("Block has no timestamp");
        }
        await this.transactionSynchronizer.addTransactions(block);
        for (let i = 0; i < block.extrinsics.length; ++i) {
            const extrinsic = block.extrinsics[i];
            if (extrinsic.method.pallet !== "timestamp") {
                logger.info("Processing extrinsic: %s", toString(extrinsic))
                await this.locSynchronizer.updateLocRequests(extrinsic, timestamp);
                await this.protectionSynchronizer.updateProtectionRequests(extrinsic);
            }
        }
    }

    private async sync(lastSyncPoint: SyncPointAggregateRoot | undefined, now: Moment, head: bigint): Promise<SyncPointAggregateRoot> {
        let current = lastSyncPoint;
        if(current === undefined) {
            current = this.syncPointFactory.newSyncPoint({
                name: TRANSACTIONS_SYNC_POINT_NAME,
                latestHeadBlockNumber: head,
                createdOn: now
            });
        } else {
            current.update({
                blockNumber: head,
                updatedOn: now
            });
        }
        await this.syncPointRepository.save(current);
        return current;
    }
}
