import { Hash } from "@logion/node-api";
import { CollectionFactory, CollectionItemAggregateRoot } from "../../../src/logion/model/collection.model.js";
import moment from "moment";

const collectionLocId = "d61e2e12-6c06-4425-aeee-2a0e969ac14e";
const itemId = Hash.fromHex("0x818f1c9cd44ed4ca11f2ede8e865c02a82f9f8a158d8d17368a6818346899705");
const addedOn = moment();

describe("CollectionFactory", () => {

    it("creates new aggregate", () => {

        const collectionItemAggregateRoot = new CollectionFactory().newItem({
            collectionLocId,
            itemId,
        });
        expect(collectionItemAggregateRoot.collectionLocId).toEqual(collectionLocId)
        expect(collectionItemAggregateRoot.itemId).toEqual(itemId.toHex())
        expect(collectionItemAggregateRoot.hasFile(Hash.of("unknown"))).toBeFalse();
    })
})

describe("CollectionItemAggregateRoot", () => {

    it("gets the expected description", () => {

        const collectionItemAggregateRoot = new CollectionItemAggregateRoot();
        collectionItemAggregateRoot.collectionLocId = collectionLocId;
        collectionItemAggregateRoot.itemId = itemId.toHex();
        collectionItemAggregateRoot.addedOn = addedOn.toDate();

        const description = collectionItemAggregateRoot.getDescription();
        expect(description.collectionLocId).toEqual(collectionLocId)
        expect(description.itemId).toEqual(itemId)
        expect(description.addedOn?.toISOString()).toEqual(addedOn.toISOString())
    })
})
