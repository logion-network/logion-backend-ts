// This file should be converted back to TS as soon as a solution is found for https://github.com/logion-network/logion-internal/issues/323

import moment from 'moment';
import { It, Mock, Times } from 'moq.ts';

import { TRANSACTIONS_SYNC_POINT_NAME } from '../../../src/logion/model/syncpoint.model';
import { BlockConsumer } from "../../../src/logion/services/blockconsumption.service";

describe("BlockConsumer", () => {

    beforeEach(() => {
        blockService = new Mock();
        syncPointRepository = new Mock();
        syncPointFactory = new Mock();
        transactionSynchronizer = new Mock();
        locSynchronizer = new Mock();
        protectionSynchronizer = new Mock();
        extrinsicDataExtractor = new Mock();
    });

    let blockService;
    let syncPointRepository;
    let syncPointFactory;
    let transactionSynchronizer;
    let locSynchronizer;
    let protectionSynchronizer;
    let extrinsicDataExtractor;

    it("does nothing given up to date", async () => {
       // Given
        const head = 12345n;
        blockService.setup(instance => instance.getHeadBlockNumber()).returns(Promise.resolve(head));
        const syncPoint = new Mock();
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

    async function consumeNewBlocks() {
        const transactionSync = new BlockConsumer(
            blockService.object(),
            syncPointRepository.object(),
            syncPointFactory.object(),
            transactionSynchronizer.object(),
            locSynchronizer.object(),
            protectionSynchronizer.object(),
            extrinsicDataExtractor.object(),
        );
        await transactionSync.consumeNewBlocks(moment());
    }

    it("consumes n new blocks", async () => {
        // Given
        const head = 10002n;
        const n = 5n;
        blockService.setup(instance => instance.getHeadBlockNumber()).returns(Promise.resolve(head));

        const block = new Mock();
        blockService.setup(instance => instance.getBlockExtrinsics(It.IsAny()))
            .returns(Promise.resolve(block.object()));
        const extrinsic = new Mock();
        extrinsic.setup(instance => instance.method).returns({ method: "method", pallet: "pallet" })
        block.setup(instance => instance.extrinsics).returns([ extrinsic.object() ]);
        const timestamp = moment();
        extrinsicDataExtractor.setup(instance => instance.getBlockTimestamp(block.object())).returns(timestamp)

        const syncPoint = new Mock();
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

        const block = new Mock();
        blockService.setup(instance => instance.getBlockExtrinsics(It.IsAny()))
            .returns(Promise.resolve(block.object()));
        const extrinsic = new Mock();
        extrinsic.setup(instance => instance.method).returns({ method: "method", pallet: "pallet" })
        extrinsic.setup(instance => instance.error).returns({ section: "errorSection", name: "error", details: "An error occurred." })
        block.setup(instance => instance.extrinsics).returns([ extrinsic.object() ]);
        const timestamp = moment();
        extrinsicDataExtractor.setup(instance => instance.getBlockTimestamp(block.object())).returns(timestamp)

        const syncPoint = new Mock();
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

        const block = new Mock();
        blockService.setup(instance => instance.getBlockExtrinsics(It.IsAny()))
            .returns(Promise.resolve(block.object()));
        const extrinsic = new Mock();
        extrinsic.setup(instance => instance.method).returns({ method: "method", pallet: "pallet" })
        block.setup(instance => instance.extrinsics).returns([ extrinsic.object() ]);
        const timestamp = moment();
        extrinsicDataExtractor.setup(instance => instance.getBlockTimestamp(block.object())).returns(timestamp)

        const syncPoint = new Mock();
        syncPoint.setup(instance => instance.latestHeadBlockNumber).returns(789789n.toString());
        syncPointRepository.setup(instance => instance.findByName(TRANSACTIONS_SYNC_POINT_NAME))
            .returns(Promise.resolve(syncPoint.object()));
        syncPointRepository.setup(instance => instance.delete(syncPoint.object()))
            .returns(Promise.resolve());

        const newSyncPoint = new Mock();
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
