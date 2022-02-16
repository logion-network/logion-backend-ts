import { connect, disconnect, checkNumOfRows, executeScript } from "../../helpers/testdb";
import { CollectionItemAggregateRoot, CollectionRepository } from "../../../src/logion/model/collection.model";
import moment from "moment";

describe("CollectionRepository", () => {

    beforeAll(async () => {
        await connect([CollectionItemAggregateRoot]);
        await executeScript("test/integration/model/collection_items.sql");
        repository = new CollectionRepository();
    });

    let repository: CollectionRepository;

    afterAll(async () => {
        await disconnect();
    });

    it("saves a Collection Item", async () => {
        // Given
        const collectionItem = new CollectionItemAggregateRoot();
        collectionItem.collectionLocId = "d61e2e12-6c06-4425-aeee-2a0e969ac14e";
        collectionItem.itemId = "0x818f1c9cd44ed4ca11f2ede8e865c02a82f9f8a158d8d17368a6818346899705";
        collectionItem.addedOn = moment().toDate();
        // When
        await repository.save(collectionItem)
        // Then
        await checkNumOfRows(`SELECT *
                              FROM collection_item
                              WHERE collection_loc_id = '${ collectionItem.collectionLocId }'
                                AND item_id = '${ collectionItem.itemId }'`, 1)
    })

    it("finds a Collection Item", async () => {
        const collectionLocId = "2035224b-ef77-4a69-aac4-e74bd030675d";
        const itemId = "0x1307990e6ba5ca145eb35e99182a9bec46531bc54ddf656a602c780fa0240dee";
        const collectionItem = await repository.findBy(
            collectionLocId,
            itemId);
        expect(collectionItem).toBeDefined()
        expect(collectionItem?.collectionLocId).toEqual(collectionLocId)
        expect(collectionItem?.itemId).toEqual(itemId)
        expect(collectionItem?.addedOn?.toISOString()).toEqual("2022-02-16T17:28:42.000Z")
    })
})
