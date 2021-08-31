import moment from 'moment';
import { It, Mock, Times } from 'moq.ts';

import { SyncPointAggregateRoot, SyncPointFactory, SyncPointRepository, TRANSACTIONS_SYNC_POINT_NAME } from '../../../src/logion/model/syncpoint.model';
import { TransactionAggregateRoot, TransactionFactory, TransactionRepository } from '../../../src/logion/model/transaction.model';
import { BlockExtrinsicsService } from '../../../src/logion/services/block.service';
import { BlockExtrinsics } from '../../../src/logion/services/types/responses/Block';
import { TransactionExtractor } from '../../../src/logion/sync/transaction.extractor';
import { TransactionSync } from "../../../src/logion/sync/transactionsync.service";
import { Transaction, BlockWithTransactionsBuilder } from "../../../src/logion/sync/transaction.vo";

describe("TransactionSync", () => {

    beforeEach(() => {
        blockService = new Mock<BlockExtrinsicsService>();
        transactionRepository = new Mock<TransactionRepository>();
        transactionFactory = new Mock<TransactionFactory>();
        transactionExtractor = new Mock<TransactionExtractor>();
        syncPointRepository = new Mock<SyncPointRepository>();
        syncPointFactory = new Mock<SyncPointFactory>();
    });

    let blockService: Mock<BlockExtrinsicsService>;
    let transactionRepository: Mock<TransactionRepository>;
    let transactionFactory: Mock<TransactionFactory>;
    let transactionExtractor: Mock<TransactionExtractor>;
    let syncPointRepository: Mock<SyncPointRepository>;
    let syncPointFactory: Mock<SyncPointFactory>;

    it("does nothing given up to date", async () => {
       // Given
        const head = 12345n;
        blockService.setup(instance => instance.getHeadBlockNumber()).returns(Promise.resolve(head));
        const syncPoint = new Mock<SyncPointAggregateRoot>();
        syncPoint.setup(instance => instance.latestHeadBlockNumber).returns(head.toString());
        syncPointRepository.setup(instance => instance.findByName(TRANSACTIONS_SYNC_POINT_NAME)).returns(
            Promise.resolve(syncPoint.object()));

        // When
        await syncTransactions()

        // Then
        blockService.verify(instance => instance.getHeadBlockNumber());
        transactionExtractor.verify(instance => instance.extractBlockWithTransactions, Times.Never());
        transactionFactory.verify(instance => instance.newTransaction, Times.Never());
        syncPointRepository.verify(instance => instance.findByName(TRANSACTIONS_SYNC_POINT_NAME));
    });

    async function syncTransactions(): Promise<void> {
        const transactionSync = new TransactionSync(
            blockService.object(),
            transactionRepository.object(),
            transactionFactory.object(),
            transactionExtractor.object(),
            syncPointRepository.object(),
            syncPointFactory.object(),
        );
        await transactionSync.syncTransactions(moment());
    }

    it("syncs n new blocks", async () => {
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

        const transaction = new Mock<Transaction>();
        const transactions = [ transaction.object() ];
        const blockWithTransaction = new BlockWithTransactionsBuilder()
                .timestamp(moment())
                .blockNumber(42n)
                .transactions(transactions)
                .build();
        transactionExtractor.setup(instance => instance.extractBlockWithTransactions(block.object()))
            .returns(blockWithTransaction);

        const transactionAggregate = new Mock<TransactionAggregateRoot>();
        transactionFactory.setup(instance => instance.newTransaction(It.IsAny()))
            .returns(transactionAggregate.object());
        transactionRepository.setup(instance => instance.save(transactionAggregate.object()))
            .returns(Promise.resolve());

        // When
        await syncTransactions();

        // Then
        blockService.verify(instance => instance.getHeadBlockNumber());
        syncPointRepository.verify(instance => instance.findByName(TRANSACTIONS_SYNC_POINT_NAME));
        blockService.verify(instance => instance.getBlockExtrinsics(It.Is(_ => true)), Times.Exactly(5));
        transactionExtractor.verify(instance => instance.extractBlockWithTransactions(block.object()), Times.Exactly(5));
        transactionFactory.verify(instance => instance.newTransaction(It.IsAny()), Times.Exactly(5));
        transactionRepository.verify(instance => instance.save(transactionAggregate.object()), Times.Exactly(5));
        syncPoint.verify(instance => instance.update(
            It.Is<{blockNumber: bigint}>(value => value.blockNumber === head)));
        syncPointRepository.verify(instance => instance.save(syncPoint.object()));
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

        const transaction = new Mock<Transaction>();
        const transactions = [ transaction.object() ];
        const blockWithTransaction = new BlockWithTransactionsBuilder()
                .timestamp(moment())
                .blockNumber(42n)
                .transactions(transactions)
                .build();
        transactionExtractor.setup(instance => instance.extractBlockWithTransactions(block.object()))
            .returns(blockWithTransaction);

        const transactionAggregate = new Mock<TransactionAggregateRoot>();
        transactionFactory.setup(instance => instance.newTransaction(It.IsAny()))
            .returns(transactionAggregate.object());
        transactionRepository.setup(instance => instance.deleteAll())
            .returns(Promise.resolve());
        transactionRepository.setup(instance => instance.save(transactionAggregate.object()))
            .returns(Promise.resolve());

        // When
        await syncTransactions();

        // Then
        blockService.verify(instance => instance.getHeadBlockNumber());
        syncPointRepository.verify(instance => instance.findByName(TRANSACTIONS_SYNC_POINT_NAME));
        transactionRepository.verify(instance => instance.deleteAll());
        blockService.verify(instance => instance.getBlockExtrinsics(It.Is(_ => true)), Times.Exactly(5));
        transactionExtractor.verify(instance => instance.extractBlockWithTransactions(block.object()), Times.Exactly(5));
        transactionFactory.verify(instance => instance.newTransaction(It.IsAny()), Times.Exactly(5));
        transactionRepository.verify(instance => instance.save(transactionAggregate.object()), Times.Exactly(5));
        syncPointRepository.verify(instance => instance.delete(syncPoint.object()));
        syncPointRepository.verify(instance => instance.save(newSyncPoint.object()));
    });
});
