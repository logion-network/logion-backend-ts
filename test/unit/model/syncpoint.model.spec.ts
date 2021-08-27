import moment from 'moment';
import { SyncPointAggregateRoot, SyncPointFactory, TRANSACTIONS_SYNC_POINT_NAME } from "../../../src/logion/model/syncpoint.model";

describe("SyncPointAggregateRoot", () => {

    it("updates", () => {
        const now = moment();
        const syncPoint = aSyncPoint();
        syncPoint.update({
            blockNumber: 42n,
            updatedOn: now
        });
        expect(syncPoint.latestHeadBlockNumber).toBe("42");
        expect(syncPoint.updatedOn).toEqual(now.toDate());
    });
});

function aSyncPoint(): SyncPointAggregateRoot {
    var syncPoint = new SyncPointAggregateRoot();
    syncPoint.name = TRANSACTIONS_SYNC_POINT_NAME;
    syncPoint.latestHeadBlockNumber = "0";
    syncPoint.updatedOn = moment().add(-1, "day").toDate();
    return syncPoint;
}

describe("SyncPointFactory", () => {

    it("creates expected root", () => {
        const now = moment();
        const transaction = new SyncPointFactory().newSyncPoint({
            name: TRANSACTIONS_SYNC_POINT_NAME,
            latestHeadBlockNumber: 42n,
            createdOn: now
        });
        expect(transaction.name).toBe(TRANSACTIONS_SYNC_POINT_NAME);
        expect(transaction.latestHeadBlockNumber).toBe("42");
        expect(transaction.updatedOn).toEqual(now.toDate());
    });
});
