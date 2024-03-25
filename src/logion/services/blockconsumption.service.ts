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
import { JsonExtrinsic, toStringWithoutError } from "./types/responses/Extrinsic.js";
import { ProgressRateLogger } from "./progressratelogger.js";
import { PrometheusService } from "./prometheus.service.js";
import { SyncPointService } from "./syncpoint.service.js";
import { VoteSynchronizer } from "./votesynchronization.service.js";
import { BlockExtrinsics } from "./types/responses/Block.js";
import { Adapters } from "@logion/node-api";
import { Block } from "../model/block.model.js";

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
        //
        // If we consider the blockchain as an array of blocks,
        // below algorithm considers the following indexing scheme:
        //
        // |0     last|       head| <-- Block numbers
        // +-+------+-+---------+-+
        // | |      | |         | | <-- Blocks
        // +-+------+-+---------+-+
        //
        // `last` is the last block that has been synchronized.
        // `head` is the chain's current head.
        // As a result, `last` is -1 when nothing has been synced yet.
        // The total number of blocks to sync is `head` - `last`.
        //
        // Also, when computing the size of a batch, the batch size is
        // `last` + `BATCH_SIZE` because the first block of the batch
        // is `last` + 1 and the last block is `last` + `BATCH_SIZE`.
        // If `last` + `BATCH_SIZE` is greater than `head`,
        // then `head` is the number of the last block to include in the batch.
        //
        const headHash = await this.blockService.getHeadBlockHash();
        const headBlock = await this.blockService.getBlockByHash(headHash);
        const head = new Block({
            blockNumber: this.blockService.getBlockNumber(headBlock.signedBlock.block),
            chainType: headBlock.chainType,
        });

        let lastSyncPoint = await this.syncPointRepository.findByName(TRANSACTIONS_SYNC_POINT_NAME);
        if (head.equalTo(lastSyncPoint?.block?.toBlock())) {
            return;
        }

        const lastBlock = this.getLastBlock({ head, lastSynced: lastSyncPoint?.block?.toBlock() });
        if (lastBlock.value === undefined) {
            throw new Error(`Out-of-sync error: ${ lastBlock.error }`);
        }

        const blocksToSync = head.blockNumber - lastBlock.value.blockNumber;
        let totalProcessedBlocks: bigint = 0n;
        let nextStop = this.getNextStop(lastBlock.value.blockNumber, head.blockNumber);
        const progressRateLogger = new ProgressRateLogger(now(), lastBlock.value.blockNumber, head.blockNumber, logger, 100n);
        let currentLast = lastBlock.value;
        while(totalProcessedBlocks < blocksToSync) {
            const nextBatchSize = nextStop - currentLast.blockNumber;
            const nextStopHash = await this.blockService.getBlockHash(nextStop);
            const blocks = await this.blockService.getBlocksUpTo(nextStopHash, nextBatchSize);

            for(let i = 0; i < blocks.length; ++i) {
                const block = blocks[i];
                const blockNumber = this.blockService.getBlockNumber(block.signedBlock.block);
                progressRateLogger.log(now(), blockNumber);
                if(!this.isEmptyBlock(block.signedBlock)) {
                    const extendedBlock = await this.blockService.getExtendedBlockByHash(block.signedBlock.block.hash);
                    await this.processBlock(extendedBlock);
                }
            }

            const batchLastBlockNumber = this.blockService.getBlockNumber(blocks[blocks.length - 1].signedBlock.block);
            currentLast = currentLast.at(batchLastBlockNumber);
            totalProcessedBlocks += BigInt(blocks.length);
            nextStop = this.getNextStop(currentLast.blockNumber, head.blockNumber);

            lastSyncPoint = await this.sync(lastSyncPoint, now(), currentLast);
            this.prometheusService.setLastSynchronizedBlock(currentLast.blockNumber);
        }
    }

    private getLastBlock(args: { head: Block, lastSynced?: Block }): { error?: string, value?: Block } {
        const { head, lastSynced } = args;
        if(lastSynced?.chainType === "Para" && head.chainType === "Solo") {
            return {
                error: "cannot revert back from solo to para",
            };
        } else if((lastSynced?.chainType === head.chainType) && lastSynced.blockNumber > head.blockNumber) {
            return {
                error: "last synced block number greater than head number",
            };
        } else {
            if(lastSynced === undefined || head.chainType !== lastSynced.chainType) {
                return {
                    value: head.at(-1n),
                };
            } else {
                return {
                    value: lastSynced,
                }
            }
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
            const unwrappedExtrinsics = this.unwrapExtrinsics(extrinsics);
            for (let i = 0; i < unwrappedExtrinsics.length; ++i) {
                const extrinsic = unwrappedExtrinsics[i];
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

    private unwrapExtrinsics(blockExtrinsics: BlockExtrinsics): JsonExtrinsic[] {
        const extrinsics: JsonExtrinsic[] = [];
        for(const extrinsic of blockExtrinsics.extrinsics) {
            extrinsics.push(extrinsic);

            if(extrinsic.call.section === "utility") {
                if(extrinsic.call.method === "batchAll" && extrinsic.error() === null) {
                    const jsonCalls = Adapters.asArray(extrinsic.call.args["calls"]);
                    for(const jsonCall of jsonCalls) {
                        const call = Adapters.asJsonCall(jsonCall);
                        extrinsics.push({
                            call,
                            signer: extrinsic.signer,
                            events: extrinsic.events, // Filtering events would require an understanding
                                                      // of underlying call, so keeping them all for now
                            tip: null, // Fees are accounted at batch level
                            partialFee: () => Promise.resolve(undefined), // Fees are accounted at batch level
                            error: () => null,
                        });
                    }
                } else if(extrinsic.call.method === "batch" || extrinsic.call.method === "forceBatch") {
                    throw new Error("Unsupported batch");
                }
            }
        }
        return extrinsics;
    }

    private async sync(lastSyncPoint: SyncPointAggregateRoot | null, now: Moment, block: Block): Promise<SyncPointAggregateRoot> {
        let current = lastSyncPoint;
        if(current === null) {
            current = this.syncPointFactory.newSyncPoint({
                name: TRANSACTIONS_SYNC_POINT_NAME,
                block,
                createdOn: now
            });
            await this.syncPointService.add(current);
        } else {
            await this.syncPointService.update(TRANSACTIONS_SYNC_POINT_NAME, {
                block,
                updatedOn: now
            });
        }
        return current;
    }

    private getNextStop(last: bigint, head: bigint): bigint {
        return last + BATCH_SIZE > head ? head : last + BATCH_SIZE;
    }
}
