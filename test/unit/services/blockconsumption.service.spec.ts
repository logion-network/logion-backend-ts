import moment from 'moment';
import { It, Mock, Times } from 'moq.ts';

import { SyncPointAggregateRoot, SyncPointFactory, SyncPointRepository, TRANSACTIONS_SYNC_POINT_NAME } from '../../../src/logion/model/syncpoint.model';
import { BlockExtrinsicsService } from '../../../src/logion/services/block.service';
import { BlockExtrinsics } from '../../../src/logion/services/types/responses/Block';
import { BlockConsumer } from "../../../src/logion/services/blockconsumption.service";
import { TransactionSynchronizer } from "../../../src/logion/services/transactionsync.service";

describe("BlockConsumer", () => {

    beforeEach(() => {
        blockService = new Mock<BlockExtrinsicsService>();
        syncPointRepository = new Mock<SyncPointRepository>();
        syncPointFactory = new Mock<SyncPointFactory>();
        transactionSynchronizer = new Mock<TransactionSynchronizer>();
    });

    let blockService: Mock<BlockExtrinsicsService>;
    let syncPointRepository: Mock<SyncPointRepository>;
    let syncPointFactory: Mock<SyncPointFactory>;
    let transactionSynchronizer: Mock<TransactionSynchronizer>;

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
        transactionSynchronizer.verify(instance => instance.reset, Times.Never());
        syncPointRepository.verify(instance => instance.findByName(TRANSACTIONS_SYNC_POINT_NAME));
    });

    async function consumeNewBlocks(): Promise<void> {
        const transactionSync = new BlockConsumer(
            blockService.object(),
            syncPointRepository.object(),
            syncPointFactory.object(),
            transactionSynchronizer.object(),
        );
        await transactionSync.consumeNewBlocks(moment());
    }

    it("consumes n new blocks", async () => {
        // Given
        const head = 10002n;
        const n = 5n;
        blockService.setup(instance => instance.getHeadBlockNumber()).returns(Promise.resolve(head));

        const block = new Mock<BlockExtrinsics>();
        blockService.setup(instance => instance.getBlockExtrinsics(It.IsAny()))
            .returns(Promise.resolve(block.object()));

        const syncPoint = new Mock<SyncPointAggregateRoot>();
        syncPoint.setup(instance => instance.latestHeadBlockNumber).returns((head - n).toString());
        syncPoint.setup(instance => instance.update(It.IsAny())).returns();
        syncPointRepository.setup(instance => instance.findByName(TRANSACTIONS_SYNC_POINT_NAME))
            .returns(Promise.resolve(syncPoint.object()));
        syncPointRepository.setup(instance => instance.save(syncPoint.object()))
            .returns(Promise.resolve());

        transactionSynchronizer.setup(instance => instance.addTransactions(block.object())).returns(Promise.resolve());

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
    });

    it("deletes all and restarts given out of sync", async () => {
        // Given
        const head = 5n;
        blockService.setup(instance => instance.getHeadBlockNumber()).returns(Promise.resolve(head));

        const block = new Mock<BlockExtrinsics>();
        blockService.setup(instance => instance.getBlockExtrinsics(It.IsAny()))
            .returns(Promise.resolve(block.object()));

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
