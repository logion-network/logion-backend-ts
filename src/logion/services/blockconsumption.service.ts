import { injectable } from "inversify";
import { Moment } from "moment";
import { SignedBlockExtended } from '@polkadot/api-derive/type/types';
import { SignedBlock } from "@polkadot/types/interfaces";
import { Log } from "@logion/rest-api-core";

import { SyncPointAggregateRoot, SyncPointFactory, SyncPointRepository, TRANSACTIONS_SYNC_POINT_NAME } from "../model/syncpoint.model.js";
import { BlockExtrinsicsService } from "./block.service.js";
import { LocSynchronizer } from "./locsynchronization.service.js";
import { TransactionSynchronizer } from "./transactionsync.service.js";
import { ProtectionSynchronizer } from "./protectionsynchronization.service.js";
import { ExtrinsicDataExtractor } from "./extrinsic.data.extractor.js";
import { toStringWithoutError } from "./types/responses/Extrinsic.js";
import { ProgressRateLogger } from "./progressratelogger.js";
import { PrometheusService } from "./prometheus.service.js";
import { SyncPointService } from "./syncpoint.service.js";
import { VoteSynchronizer } from "./votesynchronization.service.js";

const { logger } = Log;

const BATCH_SIZE = 10n;

@injectable()
export class BlockConsumer {

    constructor(
        private blockService: BlockExtrinsicsService,
        private syncPointRepository: SyncPointRepository,
        private syncPointFactory: SyncPointFactory,
        private syncPointService: SyncPointService,
        private transactionSynchronizer: TransactionSynchronizer,
        private locSynchronizer: LocSynchronizer,
        private protectionSynchronizer: ProtectionSynchronizer,
        private extrinsicDataExtractor: ExtrinsicDataExtractor,
        private prometheusService: PrometheusService,
        private voteSynchronizer: VoteSynchronizer,
    ) {}

    async consumeNewBlocks(now: () => Moment): Promise<void> {
        const headHash = await this.blockService.getHeadBlockHash();
        const headBlock = await this.blockService.getBlockByHash(headHash);
        const head = this.blockService.getBlockNumber(headBlock.block);

        let lastSyncPoint = await this.syncPointRepository.findByName(TRANSACTIONS_SYNC_POINT_NAME);
        let lastSynced = lastSyncPoint !== null ? BigInt(lastSyncPoint.latestHeadBlockNumber!) : head - 1n;
        if (lastSynced === head) {
            return;
        }

        if (lastSynced > head) {
            throw new Error("Out-of-sync error: last synced block number greater than head number");
        }

        let blocksToSync = head - lastSynced;
        let totalProcessedBlocks: bigint = 0n;
        let nextStop = this.nextStopNumber(lastSynced, head);
        const progressRateLogger = new ProgressRateLogger(now(), lastSynced, head, logger, 100n);
        while(totalProcessedBlocks < blocksToSync) {
            const nextBatchSize = nextStop - lastSynced;
            const nextStopHash = await this.blockService.getBlockHash(nextStop);
            const blocks = await this.blockService.getBlocksUpTo(nextStopHash, nextBatchSize);

            for(let i = 0; i < blocks.length; ++i) {
                const block = blocks[i];
                const blockNumber = this.blockService.getBlockNumber(block.block);
                progressRateLogger.log(now(), blockNumber);
                if(!this.isEmptyBlock(block)) {
                    const extendedBlock = await this.blockService.getExtendedBlockByHash(block.block.hash);
                    await this.processBlock(extendedBlock);
                }
            }

            const blockNumber = this.blockService.getBlockNumber(blocks[blocks.length - 1].block);
            lastSyncPoint = await this.sync(lastSyncPoint, now(), blockNumber);
            lastSynced = blockNumber;
            this.prometheusService.setLastSynchronizedBlock(lastSynced);

            totalProcessedBlocks += BigInt(blocks.length);
            nextStop = this.nextStopNumber(lastSynced, head);
        }
    }

    private isEmptyBlock(block: SignedBlock): boolean {
        return block.block.extrinsics.length <= 1;
    }

    private async processBlock(block: SignedBlockExtended): Promise<void> {
        const extrinsics = await this.blockService.getBlockExtrinsics(block);
        const timestamp = this.extrinsicDataExtractor.getBlockTimestamp(extrinsics);
        if (timestamp === undefined) {
            throw Error("Block has no timestamp");
        }
        try {
            await this.transactionSynchronizer.addTransactions(extrinsics);
            for (let i = 0; i < extrinsics.extrinsics.length; ++i) {
                const extrinsic = extrinsics.extrinsics[i];
                if (extrinsic.call.pallet !== "timestamp") {
                    logger.info("Processing extrinsic: %s", toStringWithoutError(extrinsic))
                    await this.locSynchronizer.updateLocRequests(extrinsic, timestamp);
                    await this.protectionSynchronizer.updateProtectionRequests(extrinsic);
                    await this.voteSynchronizer.updateVotes(extrinsic, timestamp);
                }
            }
        } catch(e) {
            logger.error("Extrinsics:");
            logger.error(JSON.stringify(extrinsics, (_, v) => typeof v === 'bigint' ? v.toString() : v, 4));
            throw e;
        }
    }

    private async sync(lastSyncPoint: SyncPointAggregateRoot | null, now: Moment, head: bigint): Promise<SyncPointAggregateRoot> {
        let current = lastSyncPoint;
        if(current === null) {
            current = this.syncPointFactory.newSyncPoint({
                name: TRANSACTIONS_SYNC_POINT_NAME,
                latestHeadBlockNumber: head,
                createdOn: now
            });
            await this.syncPointService.add(current);
        } else {
            await this.syncPointService.update(TRANSACTIONS_SYNC_POINT_NAME, {
                blockNumber: head,
                updatedOn: now
            });
        }
        return current;
    }

    private nextStopNumber(lastSynced: bigint, head: bigint): bigint {
        return [lastSynced + BATCH_SIZE, head].reduce((m, e) => e < m ? e : m);   
    }
}
