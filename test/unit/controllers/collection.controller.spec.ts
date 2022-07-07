import { setupApp } from "../../helpers/testapp";
import { CollectionController } from "../../../src/logion/controllers/collection.controller";
import { Container } from "inversify";
import { Mock, It } from "moq.ts";
import {
    CollectionRepository,
    CollectionItemAggregateRoot,
    CollectionFactory,
    CollectionItemFile
} from "../../../src/logion/model/collection.model";
import moment from "moment";
import request from "supertest";
import { LocRequestRepository, LocRequestAggregateRoot } from "../../../src/logion/model/locrequest.model";
import { FileStorageService } from "../../../src/logion/services/file.storage.service";
import {
    CollectionService,
    GetCollectionItemParams,
    GetCollectionItemFileParams
} from "../../../src/logion/services/collection.service";
import { CollectionItem, ItemFile } from "@logion/node-api/dist/Types";
import { writeFile } from "fs/promises";
import { fileExists } from "../../helpers/filehelper";

const collectionLocId = "d61e2e12-6c06-4425-aeee-2a0e969ac14e";
const itemId = "0x818f1c9cd44ed4ca11f2ede8e865c02a82f9f8a158d8d17368a6818346899705";
const timestamp = moment();

const SOME_DATA = 'some data';
const SOME_DATA_HASH = '0x1307990e6ba5ca145eb35e99182a9bec46531bc54ddf656a602c780fa0240dee';
const FILE_NAME = "'a-file.pdf'";
const CID = "cid-784512";

describe("CollectionController", () => {

    it("gets an existing collection item", async () => {

        const app = setupApp(CollectionController, mockModelForGet);

        await request(app)
            .get(`/api/collection/${ collectionLocId }/${ itemId }`)
            .send()
            .expect(200)
            .then(response => {
                expect(response.body.collectionLocId).toEqual(collectionLocId)
                expect(response.body.itemId).toEqual(itemId)
                expect(response.body.addedOn).toEqual(timestamp.toISOString())
            })
    })

    it("gets an error code when requesting non-existent collection item", async () => {

        const app = setupApp(CollectionController, mockModelForGet);

        await request(app)
            .get(`/api/collection/${ collectionLocId }/0x12345`)
            .send()
            .expect(400)
            .then(response => {
                expect(response.body.error).toEqual("Collection item d61e2e12-6c06-4425-aeee-2a0e969ac14e/0x12345 not found")
            })
    })

    it('adds file to collection item', async () => {
        const app = setupApp(CollectionController, container => mockModel(container, {
            fileAlreadyInDB: false,
            collectionItemPublished: true,
            filePublished: true
        }));
        const buffer = Buffer.from(SOME_DATA);
        await request(app)
            .post(`/api/collection/${ collectionLocId }/${ itemId }/files`)
            .attach('file', buffer, { filename: FILE_NAME })
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.hash).toBe(SOME_DATA_HASH);
            });
    })

    it('fails to add file to collection item if already in DB', async () => {
        const app = setupApp(CollectionController, container => mockModel(container, {
            fileAlreadyInDB: true,
            collectionItemPublished: true,
            filePublished: true
        }));
        const buffer = Buffer.from(SOME_DATA);
        await request(app)
            .post(`/api/collection/${ collectionLocId }/${ itemId }/files`)
            .attach('file', buffer, { filename: FILE_NAME })
            .expect(400)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.error).toBe("File is already uploaded");
            });
    })

    it('fails to add file to a non-existing collection item', async () => {
        const app = setupApp(CollectionController, container => mockModel(container, {
            fileAlreadyInDB: false,
            collectionItemPublished: false,
            filePublished: false
        }));
        const buffer = Buffer.from(SOME_DATA);
        await request(app)
            .post(`/api/collection/${ collectionLocId }/${ itemId }/files`)
            .attach('file', buffer, { filename: FILE_NAME })
            .expect(400)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.error).toBe("Collection Item not found on chain");
            });
    })

    it('fails to add file to a non-existing collection item file', async () => {
        const app = setupApp(CollectionController, container => mockModel(container, {
            fileAlreadyInDB: false,
            collectionItemPublished: true,
            filePublished: false
        }));
        const buffer = Buffer.from(SOME_DATA);
        await request(app)
            .post(`/api/collection/${ collectionLocId }/${ itemId }/files`)
            .attach('file', buffer, { filename: FILE_NAME })
            .expect(400)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.error).toBe("Collection Item File not found on chain");
            });
    })

    it('fails to add file if name does not match', async () => {
        const app = setupApp(CollectionController, container => mockModel(container, {
            fileAlreadyInDB: false,
            collectionItemPublished: true,
            filePublished: true
        }));
        const buffer = Buffer.from(SOME_DATA);
        await request(app)
            .post(`/api/collection/${ collectionLocId }/${ itemId }/files`)
            .attach('file', buffer, { filename: "WrongName.pdf" })
            .expect(400)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.error).toBe("Invalid name. Actually uploaded WrongName.pdf while expecting 'a-file.pdf'");
            });
    })

    it('downloads existing file given its hash', async () => {
        const app = setupApp(CollectionController, container => mockModel(container, {
            fileAlreadyInDB: true,
            collectionItemPublished: true,
            filePublished: true
        }));
        const filePath = CollectionController.tempFilePath({ collectionLocId, itemId, hash: SOME_DATA_HASH});
        await writeFile(filePath, SOME_DATA);
        await request(app)
            .get(`/api/collection/${ collectionLocId }/${ itemId }/files/${ SOME_DATA_HASH }`)
            .expect(200, SOME_DATA)
            .expect('Content-Type', /text\/plain/);
        let fileReallyExists = true;
        for (let i = 0; i < 10; ++i) {
            if (!await fileExists(filePath)) {
                fileReallyExists = false;
                break;
            }
        }
        expect(fileReallyExists).toBe(false);
    })

    it('fails to download non-existing file', async () => {
        const app = setupApp(CollectionController, container => mockModel(container, {
            fileAlreadyInDB: false,
            collectionItemPublished: true,
            filePublished: true
        }));
        const filePath = CollectionController.tempFilePath({ collectionLocId, itemId, hash: SOME_DATA_HASH});
        await writeFile(filePath, SOME_DATA);
        await request(app)
            .get(`/api/collection/${ collectionLocId }/${ itemId }/files/${ SOME_DATA_HASH }`)
            .expect(400)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.error).toBe("Trying to download a file that is not uploaded yet.");
            });
    })

    it('fails to download from a non-existing collection item file', async () => {
        const app = setupApp(CollectionController, container => mockModel(container, {
            fileAlreadyInDB: false,
            collectionItemPublished: false,
            filePublished: false
        }));
        const filePath = CollectionController.tempFilePath({ collectionLocId, itemId, hash: SOME_DATA_HASH});
        await writeFile(filePath, SOME_DATA);
        await request(app)
            .get(`/api/collection/${ collectionLocId }/${ itemId }/files/${ SOME_DATA_HASH }`)
            .expect(400)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.error).toBe("Collection Item File not found on chain");
            });
    })
})

function mockModelForGet(container: Container): void {
    return mockModel(container, { fileAlreadyInDB: true, collectionItemPublished: true, filePublished: true})
}

function mockModel(container: Container, params: { fileAlreadyInDB: boolean, collectionItemPublished: boolean, filePublished: boolean }): void {
    const { fileAlreadyInDB, collectionItemPublished, filePublished } = params;
    const collectionItem = new CollectionItemAggregateRoot()
    collectionItem.collectionLocId = collectionLocId;
    collectionItem.itemId = itemId;
    collectionItem.addedOn = timestamp.toDate();
    if (fileAlreadyInDB) {
        const collectionItemFile = new CollectionItemFile()
        collectionItemFile.collectionLocId = collectionLocId;
        collectionItemFile.itemId = itemId;
        collectionItemFile.hash = SOME_DATA_HASH;
        collectionItemFile.cid = CID;
        collectionItemFile.collectionItem = collectionItem;
        collectionItem.files = [ collectionItemFile ]
    } else {
        collectionItem.files = [];
    }
    const collectionItemFile = new Mock<CollectionItemFile>()
    const collectionRepository = new Mock<CollectionRepository>()
    collectionRepository.setup(instance => instance.findBy(collectionLocId, itemId))
        .returns(Promise.resolve(collectionItem))
    collectionRepository.setup(instance => instance.createIfNotExist(
        It.Is<string>(param => param === collectionLocId),
        It.Is<string>(param => param === itemId),
        It.IsAny<() => CollectionItemAggregateRoot>(),
    )).returns(Promise.resolve(collectionItem))
    collectionRepository.setup(instance => instance.saveFile(collectionItemFile.object()))
        .returns(Promise.resolve())
    container.bind(CollectionRepository).toConstantValue(collectionRepository.object())

    const collectionLoc = new LocRequestAggregateRoot();
    const locRequestRepository = new Mock<LocRequestRepository>();
    locRequestRepository.setup(instance => instance.findById(collectionLocId))
        .returns(Promise.resolve(collectionLoc))
    container.bind(LocRequestRepository).toConstantValue(locRequestRepository.object())

    const collectionFactory = new Mock<CollectionFactory>()
    container.bind(CollectionFactory).toConstantValue(collectionFactory.object())

    const fileStorageService = new Mock<FileStorageService>()
    const filePath = CollectionController.tempFilePath({ collectionLocId, itemId, hash: SOME_DATA_HASH });
    fileStorageService.setup(instance => instance.importFile(filePath))
        .returns(Promise.resolve(CID))
    fileStorageService.setup(instance => instance.exportFile({ cid: CID }, filePath))
        .returns(Promise.resolve())
    container.bind(FileStorageService).toConstantValue(fileStorageService.object())

    const publishedCollectionItemFile: ItemFile = {
        hash: SOME_DATA_HASH,
        name: FILE_NAME,
        contentType: "text/plain",
        size: BigInt(SOME_DATA.length)
    }

    const publishedCollectionItem: CollectionItem = {
        id: itemId,
        description: "Item Description",
        files: [ publishedCollectionItemFile ]
    }
    const collectionService = new Mock<CollectionService>()
    collectionService.setup(instance => instance.getCollectionItem(It.Is<GetCollectionItemParams>(
        param => param.collectionLocId === collectionLocId && param.itemId === itemId)
    ))
        .returns(Promise.resolve(collectionItemPublished ? publishedCollectionItem : undefined))
    collectionService.setup(instance => instance.getCollectionItemFile(It.Is<GetCollectionItemFileParams>(
        param => param.collectionLocId === collectionLocId && param.itemId === itemId && param.hash === SOME_DATA_HASH)
    ))
        .returns(Promise.resolve(filePublished ? publishedCollectionItemFile : undefined))
    container.bind(CollectionService).toConstantValue(collectionService.object())

}
