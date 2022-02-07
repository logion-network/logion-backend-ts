import moment from 'moment';
import { It, Mock, Times } from 'moq.ts';

import { SyncPointAggregateRoot, SyncPointFactory, SyncPointRepository, TRANSACTIONS_SYNC_POINT_NAME } from '../../../src/logion/model/syncpoint.model';
import { BlockExtrinsicsService } from '../../../src/logion/services/block.service';
import { BlockExtrinsics } from '../../../src/logion/services/types/responses/Block';
import { BlockConsumer } from "../../../src/logion/services/blockconsumption.service";
import { LocSynchronizer } from "../../../src/logion/services/locsynchronization.service";
import { TransactionSynchronizer } from "../../../src/logion/services/transactionsync.service";
import { ProtectionSynchronizer } from "../../../src/logion/services/protectionsynchronization.service";
import { ExtrinsicDataExtractor } from "../../../src/logion/services/extrinsic.data.extractor";
import { JsonExtrinsic } from "../../../src/logion/services/types/responses/Extrinsic";

describe("BlockConsumer", () => {

    beforeEach(() => {
        blockService = new Mock<BlockExtrinsicsService>();
        syncPointRepository = new Mock<SyncPointRepository>();
        syncPointFactory = new Mock<SyncPointFactory>();
        transactionSynchronizer = new Mock<TransactionSynchronizer>();
        locSynchronizer = new Mock<LocSynchronizer>();
        protectionSynchronizer = new Mock<ProtectionSynchronizer>();
        extrinsicDataExtractor = new Mock<ExtrinsicDataExtractor>();
    });

    let blockService: Mock<BlockExtrinsicsService>;
    let syncPointRepository: Mock<SyncPointRepository>;
    let syncPointFactory: Mock<SyncPointFactory>;
    let transactionSynchronizer: Mock<TransactionSynchronizer>;
    let locSynchronizer: Mock<LocSynchronizer>;
    let protectionSynchronizer: Mock<ProtectionSynchronizer>;
    let extrinsicDataExtractor: Mock<ExtrinsicDataExtractor>;

    it("does nothing given up to date", async () => {
       // Given
        const head = 12345n;
        blockService.setup(instance => instance.getHeadBlockNumber()).returns(Promise.resolve(head));
        const syncPoint = new Mock<SyncPointAggregateRoot>();
        syncPoint.setup(instance => instance.latestHeadBlockNumber).returns(head.toString());
        syncPointRepository.setup(instance => instance.findByName(TRANSACTIONS_SYNC_POINT_NAME)).returns(
            Promise.resolve(syncPoint.object()));

        // When
        await consumeNewBlocks()

        // Then
        blockService.verify(instance => instance.getHeadBlockNumber());
        transactionSynchronizer.verify(instance => instance.addTransactions, Times.Never());
        locSynchronizer.verify(instance => instance.updateLocRequests, Times.Never());
        transactionSynchronizer.verify(instance => instance.reset, Times.Never());
        syncPointRepository.verify(instance => instance.findByName(TRANSACTIONS_SYNC_POINT_NAME));
    });

    async function consumeNewBlocks(): Promise<void> {
        const transactionSync = new BlockConsumer(
            blockService.object(),
            syncPointRepository.object(),
            syncPointFactory.object(),
            transactionSynchronizer.object(),
            locSynchronizer.object(),
            protectionSynchronizer.object(),
            extrinsicDataExtractor.object(),
        );
        await transactionSync.consumeNewBlocks(() => moment());
    }

    it("consumes n new blocks", async () => {
        // Given
        const head = 10002n;
        const n = 5n;
        blockService.setup(instance => instance.getHeadBlockNumber()).returns(Promise.resolve(head));

        const block = new Mock<BlockExtrinsics>();
        blockService.setup(instance => instance.getBlockExtrinsics(It.IsAny()))
            .returns(Promise.resolve(block.object()));
        const extrinsic = new Mock<JsonExtrinsic>();
        extrinsic.setup(instance => instance.method).returns({ method: "method", pallet: "pallet" })
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

        transactionSynchronizer.setup(instance => instance.addTransactions(block.object())).returns(Promise.resolve());
        locSynchronizer.setup(instance => instance.updateLocRequests(extrinsic.object(), timestamp)).returns(Promise.resolve());
        protectionSynchronizer.setup(instance => instance.updateProtectionRequests(extrinsic.object())).returns(Promise.resolve());

        // When
        await consumeNewBlocks();

        // Then
        blockService.verify(instance => instance.getHeadBlockNumber());
        syncPointRepository.verify(instance => instance.findByName(TRANSACTIONS_SYNC_POINT_NAME));
        blockService.verify(instance => instance.getBlockExtrinsics(It.Is(_ => true)), Times.Exactly(5));
        syncPoint.verify(instance => instance.update(
            It.Is<{blockNumber: bigint}>(value => value.blockNumber === head)));
        syncPointRepository.verify(instance => instance.save(syncPoint.object()));

        transactionSynchronizer.verify(instance => instance.addTransactions(block.object()), Times.Exactly(5));
        locSynchronizer.verify(instance => instance.updateLocRequests(extrinsic.object(), timestamp), Times.Exactly(5));
        protectionSynchronizer.verify(instance => instance.updateProtectionRequests(extrinsic.object()), Times.Exactly(5));
    });

    it("consumes extrinsics with errors", async () => {
        // Given
        const head = 10002n;
        blockService.setup(instance => instance.getHeadBlockNumber()).returns(Promise.resolve(head));

        const block = new Mock<BlockExtrinsics>();
        blockService.setup(instance => instance.getBlockExtrinsics(It.IsAny()))
            .returns(Promise.resolve(block.object()));
        const extrinsic = new Mock<JsonExtrinsic>();
        extrinsic.setup(instance => instance.method).returns({ method: "method", pallet: "pallet" })
        extrinsic.setup(instance => instance.error).returns({ section: "errorSection", name: "error", details: "An error occurred." })
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

        transactionSynchronizer.setup(instance => instance.addTransactions(block.object())).returns(Promise.resolve());
        locSynchronizer.setup(instance => instance.updateLocRequests(extrinsic.object(), timestamp)).returns(Promise.resolve());
        protectionSynchronizer.setup(instance => instance.updateProtectionRequests(extrinsic.object())).returns(Promise.resolve());

        // When
        await consumeNewBlocks();

        // Then
        blockService.verify(instance => instance.getHeadBlockNumber());
        syncPointRepository.verify(instance => instance.findByName(TRANSACTIONS_SYNC_POINT_NAME));
        blockService.verify(instance => instance.getBlockExtrinsics(It.Is(_ => true)), Times.Exactly(1));
        syncPoint.verify(instance => instance.update(
            It.Is<{blockNumber: bigint}>(value => value.blockNumber === head)));
        syncPointRepository.verify(instance => instance.save(syncPoint.object()));

        transactionSynchronizer.verify(instance => instance.addTransactions(block.object()), Times.Exactly(1));
        locSynchronizer.verify(instance => instance.updateLocRequests(extrinsic.object(), timestamp), Times.Exactly(1));
        protectionSynchronizer.verify(instance => instance.updateProtectionRequests(extrinsic.object()), Times.Exactly(1));
    });

    it("deletes all and restarts given out of sync", async () => {
        // Given
        const head = 5n;
        blockService.setup(instance => instance.getHeadBlockNumber()).returns(Promise.resolve(head));

        const block = new Mock<BlockExtrinsics>();
        blockService.setup(instance => instance.getBlockExtrinsics(It.IsAny()))
            .returns(Promise.resolve(block.object()));
        const extrinsic = new Mock<JsonExtrinsic>();
        extrinsic.setup(instance => instance.method).returns({ method: "method", pallet: "pallet" })
        block.setup(instance => instance.extrinsics).returns([ extrinsic.object() ]);
        const timestamp = moment();
        extrinsicDataExtractor.setup(instance => instance.getBlockTimestamp(block.object())).returns(timestamp)

        const syncPoint = new Mock<SyncPointAggregateRoot>();
        syncPoint.setup(instance => instance.latestHeadBlockNumber).returns(789789n.toString());
        syncPointRepository.setup(instance => instance.findByName(TRANSACTIONS_SYNC_POINT_NAME))
            .returns(Promise.resolve(syncPoint.object()));
        syncPointRepository.setup(instance => instance.delete(syncPoint.object()))
            .returns(Promise.resolve());

        const newSyncPoint = new Mock<SyncPointAggregateRoot>();
        syncPointFactory.setup(instance => instance.newSyncPoint(It.Is<{latestHeadBlockNumber: bigint}>(
            value => value.latestHeadBlockNumber === head))).returns(newSyncPoint.object());
        syncPointRepository.setup(instance => instance.save(newSyncPoint.object()))
            .returns(Promise.resolve());

        transactionSynchronizer.setup(instance => instance.reset()).returns(Promise.resolve());
        transactionSynchronizer.setup(instance => instance.addTransactions(block.object())).returns(Promise.resolve());
        locSynchronizer.setup(instance => instance.updateLocRequests(extrinsic.object(), timestamp)).returns(Promise.resolve());
        protectionSynchronizer.setup(instance => instance.updateProtectionRequests(extrinsic.object())).returns(Promise.resolve());

        // When
        await consumeNewBlocks();

        // Then
        blockService.verify(instance => instance.getHeadBlockNumber());
        syncPointRepository.verify(instance => instance.findByName(TRANSACTIONS_SYNC_POINT_NAME));
        blockService.verify(instance => instance.getBlockExtrinsics(It.Is(_ => true)), Times.Exactly(5));
        syncPointRepository.verify(instance => instance.delete(syncPoint.object()));
        syncPointRepository.verify(instance => instance.save(newSyncPoint.object()));

        transactionSynchronizer.verify(instance => instance.reset());
    });
});
