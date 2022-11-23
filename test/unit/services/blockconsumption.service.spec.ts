import moment from 'moment';
import { It, Mock, Times } from 'moq.ts';
import type { Vec } from '@polkadot/types-codec';
import type { AnyTuple } from '@polkadot/types-codec/types';
import { GenericExtrinsic } from '@polkadot/types/extrinsic';
import { Block, Hash } from '@polkadot/types/interfaces';
import { SignedBlockExtended } from '@polkadot/api-derive/type/types';

import { SyncPointAggregateRoot, SyncPointFactory, SyncPointRepository, TRANSACTIONS_SYNC_POINT_NAME } from '../../../src/logion/model/syncpoint.model';
import { BlockExtrinsicsService } from '../../../src/logion/services/block.service';
import { BlockExtrinsics } from '../../../src/logion/services/types/responses/Block';
import { BlockConsumer } from "../../../src/logion/services/blockconsumption.service";
import { LocSynchronizer } from "../../../src/logion/services/locsynchronization.service";
import { TransactionSynchronizer } from "../../../src/logion/services/transactionsync.service";
import { ProtectionSynchronizer } from "../../../src/logion/services/protectionsynchronization.service";
import { ExtrinsicDataExtractor } from "../../../src/logion/services/extrinsic.data.extractor";
import { JsonExtrinsic } from "../../../src/logion/services/types/responses/Extrinsic";
import { PrometheusService } from '../../../src/logion/services/prometheus.service';
import { NonTransactionnalSyncPointService } from '../../../src/logion/services/syncpoint.service';

describe("BlockConsumer", () => {

    beforeEach(() => {
        blockService = new Mock<BlockExtrinsicsService>();
        syncPointRepository = new Mock<SyncPointRepository>();
        syncPointFactory = new Mock<SyncPointFactory>();
        transactionSynchronizer = new Mock<TransactionSynchronizer>();
        locSynchronizer = new Mock<LocSynchronizer>();
        protectionSynchronizer = new Mock<ProtectionSynchronizer>();
        extrinsicDataExtractor = new Mock<ExtrinsicDataExtractor>();
        prometheusService = new Mock<PrometheusService>();
    });

    let blockService: Mock<BlockExtrinsicsService>;
    let syncPointRepository: Mock<SyncPointRepository>;
    let syncPointFactory: Mock<SyncPointFactory>;
    let transactionSynchronizer: Mock<TransactionSynchronizer>;
    let locSynchronizer: Mock<LocSynchronizer>;
    let protectionSynchronizer: Mock<ProtectionSynchronizer>;
    let extrinsicDataExtractor: Mock<ExtrinsicDataExtractor>;
    let prometheusService: Mock<PrometheusService>;

    it("does nothing given up to date", async () => {
       // Given
        const head = 12345n;
        givenBlock(head);

        const syncPoint = new Mock<SyncPointAggregateRoot>();
        syncPoint.setup(instance => instance.latestHeadBlockNumber).returns(head.toString());
        syncPointRepository.setup(instance => instance.findByName(TRANSACTIONS_SYNC_POINT_NAME)).returns(
            Promise.resolve(syncPoint.object()));

        // When
        await consumeNewBlocks()

        // Then
        blockService.verify(instance => instance.getHeadBlockHash());
        transactionSynchronizer.verify(instance => instance.addTransactions, Times.Never());
        locSynchronizer.verify(instance => instance.updateLocRequests, Times.Never());
        syncPointRepository.verify(instance => instance.findByName(TRANSACTIONS_SYNC_POINT_NAME));
        prometheusService.verify(instance => instance.setLastSynchronizedBlock, Times.Never());
    });

    function givenBlock(blockNumber: bigint): SignedBlockExtended {
        const headHash = new Mock<Hash>();
        blockService.setup(instance => instance.getHeadBlockHash()).returns(Promise.resolve(headHash.object()));

        const headBlock = new Mock<SignedBlockExtended>();
        const headBlockBlock = new Mock<Block>();
        const extrinsics = new Mock<Vec<GenericExtrinsic<AnyTuple>>>();
        extrinsics.setup(instance => instance.length).returns(2);
        headBlockBlock.setup(instance => instance.extrinsics).returns(extrinsics.object());
        headBlock.setup(instance => instance.block).returns(headBlockBlock.object());
        blockService.setup(instance => instance.getBlockByHash(headHash.object())).returns(Promise.resolve(headBlock.object()));
        blockService.setup(instance => instance.getExtendedBlockByHash(headHash.object())).returns(Promise.resolve(headBlock.object()));

        blockService.setup(instance => instance.getBlockNumber(headBlockBlock.object())).returns(blockNumber);
        blockService.setup(instance => instance.getBlockHash(blockNumber)).returns(Promise.resolve(headHash.object()));

        return headBlock.object();
    }

    async function consumeNewBlocks(): Promise<void> {
        const transactionSync = new BlockConsumer(
            blockService.object(),
            syncPointRepository.object(),
            syncPointFactory.object(),
            new NonTransactionnalSyncPointService(syncPointRepository.object()),
            transactionSynchronizer.object(),
            locSynchronizer.object(),
            protectionSynchronizer.object(),
            extrinsicDataExtractor.object(),
            prometheusService.object(),
        );
        await transactionSync.consumeNewBlocks(() => moment());
    }

    it("consumes n new blocks", async () => {
        // Given
        const head = 10002n;
        const n = 5n;
        givenBlock(head);
        givenNewBlocks(n, head - n + 1n);

        const block = new Mock<BlockExtrinsics>();
        blockService.setup(instance => instance.getBlockExtrinsics(It.IsAny()))
            .returns(Promise.resolve(block.object()));
        const extrinsic = new Mock<JsonExtrinsic>();
        extrinsic.setup(instance => instance.call).returns({ method: "method", section: "pallet", args: {} })
        block.setup(instance => instance.extrinsics).returns([ extrinsic.object() ]);
        const timestamp = moment();
        extrinsicDataExtractor.setup(instance => instance.getBlockTimestamp(block.object())).returns(timestamp)

        const syncPoint = new Mock<SyncPointAggregateRoot>();
        syncPoint.setup(instance => instance.latestHeadBlockNumber).returns((head - n).toString());
        syncPoint.setup(instance => instance.update(It.IsAny())).returns();
        syncPointRepository.setup(instance => instance.findByName(TRANSACTIONS_SYNC_POINT_NAME))
            .returns(Promise.resolve(syncPoint.object()));
        syncPointRepository.setup(instance => instance.save(syncPoint.object()))
            .returns(Promise.resolve());
        prometheusService.setup(instance => instance.setLastSynchronizedBlock(It.IsAny())).returns(undefined);

        transactionSynchronizer.setup(instance => instance.addTransactions(block.object())).returns(Promise.resolve());
        locSynchronizer.setup(instance => instance.updateLocRequests(extrinsic.object(), timestamp)).returns(Promise.resolve());
        protectionSynchronizer.setup(instance => instance.updateProtectionRequests(extrinsic.object())).returns(Promise.resolve());

        // When
        await consumeNewBlocks();

        // Then
        syncPointRepository.verify(instance => instance.findByName(TRANSACTIONS_SYNC_POINT_NAME), Times.Exactly(2));
        blockService.verify(instance => instance.getBlockExtrinsics(It.Is(_ => true)), Times.Exactly(5));
        syncPoint.verify(instance => instance.update(
            It.Is<{blockNumber: bigint}>(value => value.blockNumber === head)));
        syncPointRepository.verify(instance => instance.save(syncPoint.object()));

        transactionSynchronizer.verify(instance => instance.addTransactions(block.object()), Times.Exactly(5));
        locSynchronizer.verify(instance => instance.updateLocRequests(extrinsic.object(), timestamp), Times.Exactly(5));
        protectionSynchronizer.verify(instance => instance.updateProtectionRequests(extrinsic.object()), Times.Exactly(5));
        prometheusService.verify(instance => instance.setLastSynchronizedBlock);
    });

    function givenNewBlocks(blocks: bigint, startBlockNumber: bigint) {
        const blocksArray = new Array<SignedBlockExtended>(Number(blocks));
        for(let i = startBlockNumber; i < startBlockNumber + blocks; ++i) {
            blocksArray[Number(i - startBlockNumber)] = givenBlock(i);
        }
        blockService.setup(instance => instance.getBlocksUpTo(It.IsAny(), It.IsAny())).returns(Promise.resolve(blocksArray));
    }

    it("consumes extrinsics with errors", async () => {
        // Given
        const head = 10002n;
        givenBlock(head);
        givenNewBlocks(1n, head);

        const block = new Mock<BlockExtrinsics>();
        blockService.setup(instance => instance.getBlockExtrinsics(It.IsAny()))
            .returns(Promise.resolve(block.object()));
        const extrinsic = new Mock<JsonExtrinsic>();
        extrinsic.setup(instance => instance.call).returns({ method: "method", section: "pallet", args: {} })
        extrinsic.setup(instance => instance.error).returns(() => ({ section: "errorSection", name: "error", details: "An error occurred." }))
        block.setup(instance => instance.extrinsics).returns([ extrinsic.object() ]);
        const timestamp = moment();
        extrinsicDataExtractor.setup(instance => instance.getBlockTimestamp(block.object())).returns(timestamp)

        const syncPoint = new Mock<SyncPointAggregateRoot>();
        syncPoint.setup(instance => instance.latestHeadBlockNumber).returns((head - 1n).toString());
        syncPoint.setup(instance => instance.update(It.IsAny())).returns();
        syncPointRepository.setup(instance => instance.findByName(TRANSACTIONS_SYNC_POINT_NAME))
            .returns(Promise.resolve(syncPoint.object()));
        syncPointRepository.setup(instance => instance.save(syncPoint.object()))
            .returns(Promise.resolve());
        prometheusService.setup(instance => instance.setLastSynchronizedBlock(It.IsAny())).returns(undefined);

        transactionSynchronizer.setup(instance => instance.addTransactions(block.object())).returns(Promise.resolve());
        locSynchronizer.setup(instance => instance.updateLocRequests(extrinsic.object(), timestamp)).returns(Promise.resolve());
        protectionSynchronizer.setup(instance => instance.updateProtectionRequests(extrinsic.object())).returns(Promise.resolve());

        // When
        await consumeNewBlocks();

        // Then
        syncPointRepository.verify(instance => instance.findByName(TRANSACTIONS_SYNC_POINT_NAME), Times.Exactly(2));
        blockService.verify(instance => instance.getBlockExtrinsics(It.Is(_ => true)), Times.Exactly(1));
        syncPoint.verify(instance => instance.update(
            It.Is<{blockNumber: bigint}>(value => value.blockNumber === head)));
        syncPointRepository.verify(instance => instance.save(syncPoint.object()));

        transactionSynchronizer.verify(instance => instance.addTransactions(block.object()), Times.Exactly(1));
        locSynchronizer.verify(instance => instance.updateLocRequests(extrinsic.object(), timestamp), Times.Exactly(1));
        protectionSynchronizer.verify(instance => instance.updateProtectionRequests(extrinsic.object()), Times.Exactly(1));
        prometheusService.verify(instance => instance.setLastSynchronizedBlock, Times.Exactly(1));
    });

    it("fails when out of sync", async () => {
        // Given
        const head = 5n;
        givenBlock(head);
        givenNewBlocks(5n, 1n);

        const block = new Mock<BlockExtrinsics>();
        blockService.setup(instance => instance.getBlockExtrinsics(It.IsAny()))
            .returns(Promise.resolve(block.object()));
        const extrinsic = new Mock<JsonExtrinsic>();
        extrinsic.setup(instance => instance.call).returns({ method: "method", section: "pallet", args: {} })
        block.setup(instance => instance.extrinsics).returns([ extrinsic.object() ]);
        const timestamp = moment();
        extrinsicDataExtractor.setup(instance => instance.getBlockTimestamp(block.object())).returns(timestamp)

        const syncPoint = new Mock<SyncPointAggregateRoot>();
        syncPoint.setup(instance => instance.latestHeadBlockNumber).returns(789789n.toString());
        syncPointRepository.setup(instance => instance.findByName(TRANSACTIONS_SYNC_POINT_NAME))
            .returns(Promise.resolve(syncPoint.object()));

        // When
        await expectAsync(consumeNewBlocks()).toBeRejectedWithError("Out-of-sync error: last synced block number greater than head number");
    });
});
