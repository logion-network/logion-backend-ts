import { injectable } from "inversify";
import { Moment } from "moment";
import { SyncPointFactory, SyncPointRepository, TRANSACTIONS_SYNC_POINT_NAME } from "../model/syncpoint.model";
import { BlockExtrinsicsService } from "./block.service";
import { LocSynchronizer } from "./locsynchronization.service";
import { Log } from "../util/Log";
import { TransactionSynchronizer } from "./transactionsync.service";
import { ProtectionSynchronizer } from "./protectionsynchronization.service";

const { logger } = Log;

@injectable()
export class BlockConsumer {

    constructor(
        private blockService: BlockExtrinsicsService,
        private syncPointRepository: SyncPointRepository,
        private syncPointFactory: SyncPointFactory,
        private transactionSynchronizer: TransactionSynchronizer,
        private locSynchronizer: LocSynchronizer,
        private protectionSynchronizer: ProtectionSynchronizer,
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

        for (let blockNumber: bigint = lastSynced + 1n; blockNumber <= head; blockNumber++) {
            logger.debug("Scanning block %d/%d", blockNumber, head);
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
            await this.transactionSynchronizer.addTransactions(block);
            await this.locSynchronizer.updateLocRequests(block);
            await this.protectionSynchronizer.updateProtectionRequests(block);
    }
}
