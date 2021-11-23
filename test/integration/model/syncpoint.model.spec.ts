import moment from 'moment';
import { connect, disconnect, executeScript, query } from '../../helpers/testdb';
import {
    SyncPointAggregateRoot,
    SyncPointRepository,
    TRANSACTIONS_SYNC_POINT_NAME,
} from "../../../src/logion/model/syncpoint.model";

describe('SyncPointRepository', () => {

    beforeAll(async () => {
        await connect([SyncPointAggregateRoot]);
        await executeScript("test/integration/model/syncpoints.sql");
        repository = new SyncPointRepository();
    });

    let repository: SyncPointRepository;

    afterAll(async () => {
        await disconnect();
    });

    it("finds transactions sync point", async () => {
        const syncPoint = await repository.findByName(TRANSACTIONS_SYNC_POINT_NAME);
        expect(syncPoint).toBeDefined();
        expect(syncPoint!.latestHeadBlockNumber).toBe("89964");
        expect(syncPoint!.updatedOn).toEqual(moment("2021-08-25T14:38:09.514126").toDate());
    });

    it("saves new sync point", async () => {
        // Given
        const syncPoint = new SyncPointAggregateRoot();
        syncPoint.name = 'AnotherSyncPoint'
        syncPoint.latestHeadBlockNumber = "123"
        syncPoint.updatedOn = moment().toDate()
        // When
        await repository.save(syncPoint)
        // Then
        const rawData:any[] | undefined = await query(`SELECT * FROM sync_point  WHERE name = '${syncPoint.name}'`);
        expect(rawData).toBeDefined()
        expect(rawData!.length).toBe(1)
    })
});
