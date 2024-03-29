import { TestDb } from "@logion/rest-api-core";
import {
    CollectionItemAggregateRoot,
    CollectionRepository,
    CollectionItemFile,
    CollectionItemFileDelivered,
    TermsAndConditionsElement,
} from "../../../src/logion/model/collection.model.js";
import moment from "moment";
import { CollectionService, TransactionalCollectionService } from "../../../src/logion/services/collection.service.js";
import { Hash } from "@logion/node-api";

const { connect, disconnect, checkNumOfRows, executeScript } = TestDb;

describe("CollectionRepository", () => {

    beforeAll(async () => {
        await connect([CollectionItemAggregateRoot, CollectionItemFile, CollectionItemFileDelivered, TermsAndConditionsElement]);
        await executeScript("test/integration/model/collection_items.sql");
        repository = new CollectionRepository();
        service = new TransactionalCollectionService(repository);
    });

    let repository: CollectionRepository;
    let service: CollectionService;

    afterAll(async () => {
        await disconnect();
    });

    it("creates a new Collection Item", async () => {

        await checkCreateIfNotExist("80aba056-acb2-41d6-89a3-cd94ada86195", "0x818f1c9cd44ed4ca11f2ede8e865c02a82f9f8a158d8d17368a6818346899705", 0)

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
        await repository.save(collectionItem)
        // Then
        await checkNumOfRows(`SELECT *
                              FROM collection_item
                              WHERE collection_loc_id = '${ collectionLocId }'
                                AND item_id = '${ itemId }'`, 1)

    }

    it("finds a Collection Item with no files", async () => {
        const collectionLocId = "2035224b-ef77-4a69-aac4-e74bd030675d";
        const itemId = Hash.fromHex("0x1307990e6ba5ca145eb35e99182a9bec46531bc54ddf656a602c780fa0240dee");
        const collectionItem = await repository.findBy(
            collectionLocId,
            itemId
        );
        expect(collectionItem).toBeDefined()
        expect(collectionItem?.collectionLocId).toEqual(collectionLocId)
        expect(collectionItem?.itemId).toEqual(itemId.toHex())
        expect(collectionItem?.addedOn?.toISOString()).toEqual("2022-02-16T17:28:42.000Z")
        expect(collectionItem?.files).toEqual([])
    })

    it("finds a Collection Item with 2 files, one being delivered and some T&Cs", async () => {
        const collectionLocId = "296d3d8f-057f-445c-b4c8-59aa7d2d21de";
        const itemId = Hash.fromHex("0x1307990e6ba5ca145eb35e99182a9bec46531bc54ddf656a602c780fa0240dee");
        const collectionItem = await repository.findBy(
            collectionLocId,
            itemId
        );
        expect(collectionItem).toBeDefined()
        expect(collectionItem?.collectionLocId).toEqual(collectionLocId)
        expect(collectionItem?.itemId).toEqual(itemId.toHex())
        expect(collectionItem?.addedOn?.toISOString()).toEqual("2022-02-16T17:28:42.000Z")
        expect(collectionItem?.files?.length).toEqual(2)
        expect(collectionItem?.files?.map(file => file.cid)).toContain("123456")
        expect(collectionItem?.files?.map(file => file.cid)).toContain("78910")

        const deliveredList = collectionItem?.getFile(Hash.fromHex("0x979ff1da4670561bf3f521a1a1d4aad097d617d2fa2c0e75d52efe90e7b7ce83")).delivered!;
        expect(deliveredList.length).toBe(2)

        const delivered1 = deliveredList.find(delivered => delivered.deliveredFileHash === "0x38c79034a97d8827559f883790d52a1527f6e7d37e66ac8e70bafda216fda6d7");
        expect(delivered1?.generatedOn).toBeDefined()
        expect(delivered1?.owner).toBe("0x900edc98db53508e6742723988B872dd08cd09c2")

        const delivered2 = deliveredList.find(delivered => delivered.deliveredFileHash === "0xf35e4bcbc1b0ce85af90914e04350cce472a2f01f00c0f7f8bc5c7ba04da2bf2");
        expect(delivered2?.generatedOn).toBeDefined()
        expect(delivered2?.owner).toBe("0x900edc98db53508e6742723988B872dd08cd09c3")

        expect(collectionItem?.termsAndConditions?.length).toBe(1);
        if(collectionItem?.termsAndConditions) {
            expect(collectionItem?.termsAndConditions[0].index).toBe(0);
            expect(collectionItem?.termsAndConditions[0].type).toBe("CC4.0");
            expect(collectionItem?.termsAndConditions[0].details).toBe("BY");
        }
    })

    it("sets a file's CID", async () => {
        // Given
        const collectionLocId = "c38e5ab8-785f-4e26-91bd-f9cdef82f601";
        const itemId = Hash.fromHex("0x1307990e6ba5ca145eb35e99182a9bec46531bc54ddf656a602c780fa0240dee");
        const hash = Hash.fromHex("0x979ff1da4670561bf3f521a1a1d4aad097d617d2fa2c0e75d52efe90e7b7ce83");
        const cid = "147852";

        await service.update(collectionLocId, itemId, async item => {
            item.setFileCid({ hash, cid });
        });

        await checkNumOfRows(`SELECT *
                              FROM collection_item_file
                              WHERE collection_loc_id = '${ collectionLocId }'
                                AND item_id = '${ itemId.toHex() }'
                                AND hash = '${ hash.toHex() }'
                                AND cid = '${ cid }'`, 1)
    })

    it("Saves a collection item that already has files", async () => {
        const collectionItem = new CollectionItemAggregateRoot();
        collectionItem.collectionLocId = "52d29fe9-983f-44d2-9e23-c8cb542981a3"
        collectionItem.itemId = "0x1307990e6ba5ca145eb35e99182a9bec46531bc54ddf656a602c780fa0240dee"
        collectionItem.addedOn = moment().toDate();

        await repository.save(collectionItem);

        const updated = await repository.findBy(collectionItem.collectionLocId, Hash.fromHex(collectionItem.itemId));
        expect(updated?.files?.length).toEqual(2)
    })

    it("Adds delivery to file", async () => {
        const collectionLocId = '52d29fe9-983f-44d2-9e23-c8cb542981a3';
        const itemId = Hash.fromHex("0x1307990e6ba5ca145eb35e99182a9bec46531bc54ddf656a602c780fa0240dee");
        const hash = Hash.fromHex("0x8bd8548beac4ce719151dc2ae893f8edc658a566e5ff654104783e14fb44012e");
        const deliveredFileHash = Hash.fromHex("0x38c79034a97d8827559f883790d52a1527f6e7d37e66ac8e70bafda216fda6d7");
        const generatedOn = moment();
        const owner = "0x900edc98db53508e6742723988B872dd08cd09c2";
        await service.update(collectionLocId, itemId, async item => {
            const file = item.getFile(hash);
            file.addDeliveredFile({
                deliveredFileHash,
                generatedOn,
                owner,
            })
        });
    })

    it("finds latest delivery", async () => {
        const delivered = await repository.findLatestDelivery({
            collectionLocId: "296d3d8f-057f-445c-b4c8-59aa7d2d21de",
            itemId: Hash.fromHex("0x1307990e6ba5ca145eb35e99182a9bec46531bc54ddf656a602c780fa0240dee"),
            fileHash: Hash.fromHex("0x979ff1da4670561bf3f521a1a1d4aad097d617d2fa2c0e75d52efe90e7b7ce83"),
        });
        expect(delivered?.deliveredFileHash).toBe("0xf35e4bcbc1b0ce85af90914e04350cce472a2f01f00c0f7f8bc5c7ba04da2bf2");
    })

    it("finds latest deliveries", async () => {
        const delivered = await repository.findLatestDeliveries({
            collectionLocId: "296d3d8f-057f-445c-b4c8-59aa7d2d21de",
            itemId: Hash.fromHex("0x1307990e6ba5ca145eb35e99182a9bec46531bc54ddf656a602c780fa0240dee"),
        });
        expect("0x979ff1da4670561bf3f521a1a1d4aad097d617d2fa2c0e75d52efe90e7b7ce83" in delivered).toBe(true);
        const fileDeliveries = delivered["0x979ff1da4670561bf3f521a1a1d4aad097d617d2fa2c0e75d52efe90e7b7ce83"];
        expect(fileDeliveries.length).toBe(2);
        expect(fileDeliveries[0].deliveredFileHash).toBe("0xf35e4bcbc1b0ce85af90914e04350cce472a2f01f00c0f7f8bc5c7ba04da2bf2");
        expect(fileDeliveries[1].deliveredFileHash).toBe("0x38c79034a97d8827559f883790d52a1527f6e7d37e66ac8e70bafda216fda6d7");
    })

    it("finds all items of a collection", async () => {
        const items = await repository.findAllBy("296d3d8f-057f-445c-b4c8-59aa7d2d21de");
        expect(items.length).toBe(2);
        expect(items[0].itemId).toBe("0xf35e4bcbc1b0ce85af90914e04350cce472a2f01f00c0f7f8bc5c7ba04da2bf2");
        expect(items[1].itemId).toBe("0x1307990e6ba5ca145eb35e99182a9bec46531bc54ddf656a602c780fa0240dee");
    })

    it("counts", async () => {
        expect(await repository.countBy("296d3d8f-057f-445c-b4c8-59aa7d2d21de")).toEqual(2);
    })
})
