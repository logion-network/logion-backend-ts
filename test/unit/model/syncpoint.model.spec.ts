import moment from 'moment';
import { SyncPointAggregateRoot, SyncPointFactory, TRANSACTIONS_SYNC_POINT_NAME } from "../../../src/logion/model/syncpoint.model.js";
import { Block, EmbeddableBlock } from '../../../src/logion/model/block.model.js';

describe("SyncPointAggregateRoot", () => {

    it("updates", () => {
        const now = moment();
        const syncPoint = aSyncPoint();
        syncPoint.update({
            block: Block.soloBlock(42n),
            updatedOn: now
        });
        expect(syncPoint.block?.blockNumber).toBe("42");
        expect(syncPoint.block?.chainType).toBe("Solo");
        expect(syncPoint.updatedOn).toEqual(now.toDate());
    });
});

function aSyncPoint(): SyncPointAggregateRoot {
    var syncPoint = new SyncPointAggregateRoot();
    syncPoint.name = TRANSACTIONS_SYNC_POINT_NAME;
    syncPoint.block = EmbeddableBlock.from(Block.soloBlock(0n));
    syncPoint.updatedOn = moment().add(-1, "day").toDate();
    return syncPoint;
}

describe("SyncPointFactory", () => {

    it("creates expected root", () => {
        const now = moment();
        const syncPoint = new SyncPointFactory().newSyncPoint({
            name: TRANSACTIONS_SYNC_POINT_NAME,
            block: Block.soloBlock(42n),
            createdOn: now
        });
        expect(syncPoint.name).toBe(TRANSACTIONS_SYNC_POINT_NAME);
        expect(syncPoint.block?.blockNumber).toBe("42");
        expect(syncPoint.block?.chainType).toBe("Solo");
        expect(syncPoint.updatedOn).toEqual(now.toDate());
    });
});
