import { connect, disconnect, checkNumOfRows, executeScript } from "../../helpers/testdb";
import {
    CollectionItemAggregateRoot,
    CollectionRepository,
    CollectionItemFile,
    CollectionItemFileDelivered
} from "../../../src/logion/model/collection.model";
import moment from "moment";

describe("CollectionRepository", () => {

    beforeAll(async () => {
        await connect([CollectionItemAggregateRoot, CollectionItemFile, CollectionItemFileDelivered]);
        await executeScript("test/integration/model/collection_items.sql");
        repository = new CollectionRepository();
    });

    let repository: CollectionRepository;

    afterAll(async () => {
        await disconnect();
    });

    it("creates a new Collection Item with getOrCreate", async () => {

        await checkCreateIfNotExist("80aba056-acb2-41d6-89a3-cd94ada86195", "0x818f1c9cd44ed4ca11f2ede8e865c02a82f9f8a158d8d17368a6818346899705", 0)

    })

    it("gets an existing Collection Item", async () => {

        await checkCreateIfNotExist("2035224b-ef77-4a69-aac4-e74bd030675d", "0x1307990e6ba5ca145eb35e99182a9bec46531bc54ddf656a602c780fa0240dee", 1)

    })

    async function checkCreateIfNotExist(collectionLocId: string, itemId: string, numOfRowsBefore: number) {
        // Given
        const collectionItem = new CollectionItemAggregateRoot();
        collectionItem.collectionLocId = collectionLocId;
        collectionItem.itemId = itemId;
        collectionItem.addedOn = moment().toDate();

        // Preliminary check
        await checkNumOfRows(`SELECT *
                              FROM collection_item
                              WHERE collection_loc_id = '${ collectionLocId }'
                                AND item_id = '${ itemId }'`, numOfRowsBefore)


        // When
        await repository.createIfNotExist(collectionLocId, itemId, () => collectionItem)
        // Then
        await checkNumOfRows(`SELECT *
                              FROM collection_item
                              WHERE collection_loc_id = '${ collectionLocId }'
                                AND item_id = '${ itemId }'`, 1)

    }

    it("finds a Collection Item with no files", async () => {
        const collectionLocId = "2035224b-ef77-4a69-aac4-e74bd030675d";
        const itemId = "0x1307990e6ba5ca145eb35e99182a9bec46531bc54ddf656a602c780fa0240dee";
        const collectionItem = await repository.findBy(
            collectionLocId,
            itemId);
        expect(collectionItem).toBeDefined()
        expect(collectionItem?.collectionLocId).toEqual(collectionLocId)
        expect(collectionItem?.itemId).toEqual(itemId)
        expect(collectionItem?.addedOn?.toISOString()).toEqual("2022-02-16T17:28:42.000Z")
        expect(collectionItem?.files).toEqual([])
    })

    it("finds a Collection Item with 2 files, one being delivered", async () => {
        const collectionLocId = "296d3d8f-057f-445c-b4c8-59aa7d2d21de";
        const itemId = "0x1307990e6ba5ca145eb35e99182a9bec46531bc54ddf656a602c780fa0240dee";
        const collectionItem = await repository.findBy(
            collectionLocId,
            itemId);
        expect(collectionItem).toBeDefined()
        expect(collectionItem?.collectionLocId).toEqual(collectionLocId)
        expect(collectionItem?.itemId).toEqual(itemId)
        expect(collectionItem?.addedOn?.toISOString()).toEqual("2022-02-16T17:28:42.000Z")
        expect(collectionItem?.files?.length).toEqual(2)
        expect(collectionItem?.files?.map(file => file.cid)).toContain("123456")
        expect(collectionItem?.files?.map(file => file.cid)).toContain("78910")
        expect(collectionItem?.getFile("0x979ff1da4670561bf3f521a1a1d4aad097d617d2fa2c0e75d52efe90e7b7ce83").delivered?.length).toBe(1)
        const delivered = collectionItem?.getFile("0x979ff1da4670561bf3f521a1a1d4aad097d617d2fa2c0e75d52efe90e7b7ce83").delivered![0]
        expect(delivered?.generatedOn).toBeDefined()
        expect(delivered?.owner).toBe("0x900edc98db53508e6742723988B872dd08cd09c2")
        expect(delivered?.deliveredFileHash).toBe("0x38c79034a97d8827559f883790d52a1527f6e7d37e66ac8e70bafda216fda6d7")
    })

    it("adds a file to an existing Collection Item", async () => {
        // Given
        const file: CollectionItemFile = new CollectionItemFile()
        file.collectionLocId = "c38e5ab8-785f-4e26-91bd-f9cdef82f601"
        file.itemId = "0x1307990e6ba5ca145eb35e99182a9bec46531bc54ddf656a602c780fa0240dee";
        file.hash = "0x979ff1da4670561bf3f521a1a1d4aad097d617d2fa2c0e75d52efe90e7b7ce83"
        file.cid = "147852";

        await repository.saveFile(file)

        await checkNumOfRows(`SELECT *
                              FROM collection_item_file
                              WHERE collection_loc_id = '${ file.collectionLocId }'
                                AND item_id = '${ file.itemId }'
                                AND hash = '${ file.hash }'
                                AND cid = '${ file.cid }'`, 1)
    })

    it("Saves a collection item that already has files", async () => {
        const collectionItem = new CollectionItemAggregateRoot();
        collectionItem.collectionLocId = "52d29fe9-983f-44d2-9e23-c8cb542981a3"
        collectionItem.itemId = "0x1307990e6ba5ca145eb35e99182a9bec46531bc54ddf656a602c780fa0240dee"
        collectionItem.addedOn = moment().toDate();

        await repository.save(collectionItem);

        const updated = await repository.findBy(collectionItem.collectionLocId, collectionItem.itemId);
        expect(updated?.files?.length).toEqual(2)
    })

    it("Adds files to synced", async () => {
        const collectionItemFile = new CollectionItemFile();
        collectionItemFile.collectionLocId = 'f14c0bd4-9ed1-4c46-9b42-47c63e09223f';
        collectionItemFile.itemId = "0x1307990e6ba5ca145eb35e99182a9bec46531bc54ddf656a602c780fa0240dee";
        collectionItemFile.hash = "0x1307990e6ba5ca145eb35e99182a9bec46531bc54ddf656a602c780fa0240dee";
        collectionItemFile.cid = "78945678424";
        await repository.saveFile(collectionItemFile)
    })

    it("Adds delivery to file", async () => {
        const delivered = new CollectionItemFileDelivered();
        delivered.collectionLocId = '52d29fe9-983f-44d2-9e23-c8cb542981a3';
        delivered.itemId = "0x1307990e6ba5ca145eb35e99182a9bec46531bc54ddf656a602c780fa0240dee";
        delivered.hash = "0x8bd8548beac4ce719151dc2ae893f8edc658a566e5ff654104783e14fb44012e";
        delivered.deliveredFileHash = "0x38c79034a97d8827559f883790d52a1527f6e7d37e66ac8e70bafda216fda6d7";
        delivered.generatedOn = new Date();
        delivered.owner = "0x900edc98db53508e6742723988B872dd08cd09c2";
        await repository.saveDelivered(delivered)
    })
})
