import { CollectionFactory } from "../../../src/logion/model/collection.model";
import moment from "moment";

describe("CollectionFactory", () => {

    it("creates new aggregate", () => {

        const collectionLocId = "d61e2e12-6c06-4425-aeee-2a0e969ac14e";
        const itemId = "0x818f1c9cd44ed4ca11f2ede8e865c02a82f9f8a158d8d17368a6818346899705";
        const addedOn = moment();
        const collectionItemAggregateRoot = new CollectionFactory().newItem({
            collectionLocId,
            description: {
                itemId,
                addedOn,
            }
        });
        expect(collectionItemAggregateRoot.collectionLocId).toEqual(collectionLocId)
        expect(collectionItemAggregateRoot.itemId).toEqual(itemId)
        expect(collectionItemAggregateRoot.addedOn).toEqual(addedOn.toDate())
    })
})
