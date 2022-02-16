import { connect, disconnect, checkNumOfRows } from "../../helpers/testdb";
import { CollectionItemAggregateRoot, CollectionRepository } from "../../../src/logion/model/collection.model";
import moment from "moment";

describe("CollectionRepository", () => {

    beforeAll(async () => {
        await connect([CollectionItemAggregateRoot]);
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
})
