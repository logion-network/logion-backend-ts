import { TestApp } from "@logion/rest-api-core";
import { Container } from "inversify";
import { Mock, It } from "moq.ts";
import { CollectionItem, Hash, ItemFile, ValidAccountId } from "@logion/node-api";
import { writeFile } from "fs/promises";
import { CollectionController } from "../../../src/logion/controllers/collection.controller.js";
import {
    CollectionRepository,
    CollectionItemAggregateRoot,
    CollectionFactory,
    CollectionItemFile,
    CollectionItemFileDelivered,
    CollectionItemToken
} from "../../../src/logion/model/collection.model.js";
import moment from "moment";
import request from "supertest";
import {
    LocRequestRepository,
    LocRequestAggregateRoot,
    LocFile,
    LocFileDelivered, EmbeddableLifecycle
} from "../../../src/logion/model/locrequest.model.js";
import { FileStorageService } from "../../../src/logion/services/file.storage.service.js";
import {
    CollectionService,
    GetCollectionItemParams,
    GetCollectionItemFileParams,
    NonTransactionalCollectionService,
    LogionNodeCollectionService,
} from "../../../src/logion/services/collection.service.js";
import { fileExists } from "../../helpers/filehelper.js";
import { OwnershipCheckService } from "../../../src/logion/services/ownershipcheck.service.js";
import { RestrictedDeliveryService } from "../../../src/logion/services/restricteddelivery.service.js";
import { ALICE, ALICE_ACCOUNT } from "../../helpers/addresses.js";
import {
    LocRequestService,
    NonTransactionalLocRequestService
} from "../../../src/logion/services/locrequest.service.js";
import {
    EmbeddableAccountId,
    EmbeddableNullableAccountId
} from "../../../src/logion/model/supportedaccountid.model.js";
import { ItIsHash } from "../../helpers/Mock.js";

const collectionLocId = "d61e2e12-6c06-4425-aeee-2a0e969ac14e";
const collectionLocOwner = ALICE_ACCOUNT;
const collectionRequester = ValidAccountId.polkadot("5EBxoSssqNo23FvsDeUxjyQScnfEiGxJaNwuwqBH2Twe35BX");
const itemId = Hash.fromHex("0x818f1c9cd44ed4ca11f2ede8e865c02a82f9f8a158d8d17368a6818346899705");
const timestamp = moment();

const SOME_DATA = 'some data';
const SOME_DATA_HASH = Hash.fromHex('0x1307990e6ba5ca145eb35e99182a9bec46531bc54ddf656a602c780fa0240dee');
const FILE_NAME = "'a-file.pdf'";
const CID = "cid-784512";
const CONTENT_TYPE = "text/plain";

const ITEM_TOKEN_OWNER = "0x900edc98db53508e6742723988B872dd08cd09c3";
const DELIVERY_HASH = Hash.fromHex('0xf35e4bcbc1b0ce85af90914e04350cce472a2f01f00c0f7f8bc5c7ba04da2bf2');

const { setupApp, mockAuthenticationWithAuthenticatedUser, mockAuthenticatedUser } = TestApp;

describe("CollectionController", () => {

    it("gets all items in a collection", async () => {

        const app = setupApp(CollectionController, container => mockModelForGet(container, true));

        await request(app)
            .get(`/api/collection/${ collectionLocId }`)
            .send()
            .expect(200)
            .then(response => {
                expect(response.body.items.length).toBe(1)
            })
    })

    it("gets an existing collection item in DB", async () => {

        const app = setupApp(CollectionController, container => mockModelForGet(container, true));

        await request(app)
            .get(`/api/collection/${ collectionLocId }/items/${ itemId.toHex() }`)
            .send()
            .expect(200)
            .then(response => {
                expect(response.body.collectionLocId).toEqual(collectionLocId)
                expect(response.body.itemId).toEqual(itemId.toHex())
                expect(response.body.addedOn).toEqual(timestamp.toISOString())
                expect(response.body.files[0].hash).toEqual(SOME_DATA_HASH.toHex())
            })
    })

    it("gets an error code when requesting non-existent collection item", async () => {

        const app = setupApp(CollectionController, container => mockModelForGet(container, false));

        const unknownItem = Hash.of("unknown item").toHex();
        await request(app)
            .get(`/api/collection/${ collectionLocId }/items/${ unknownItem }`)
            .send()
            .expect(400)
            .then(response => {
                expect(response.body.errorMessage).toEqual(`Collection item d61e2e12-6c06-4425-aeee-2a0e969ac14e/${ unknownItem } not found`)
            })
    })

    it('uploads collection item file', async () => {
        const app = setupApp(CollectionController, container => mockModel(container, {
            hasFile: true,
            fileAlreadyUploaded: false,
            collectionItemPublished: true,
            restrictedDelivery: false,
            fileType: "Item",
        }));
        const buffer = Buffer.from(SOME_DATA);
        await request(app)
            .post(`/api/collection/${ collectionLocId }/${ itemId.toHex() }/files`)
            .field({ hash: SOME_DATA_HASH.toHex() })
            .attach('file', buffer, { filename: FILE_NAME })
            .expect(200);
    })

    it('fails to add file to collection item if wrong hash', async () => {
        const app = setupApp(CollectionController, container => mockModel(container, {
            hasFile: true,
            fileAlreadyUploaded: true,
            collectionItemPublished: true,
            restrictedDelivery: false,
            fileType: "Item",
        }));
        const buffer = Buffer.from(SOME_DATA);
        const wrongHash = Hash.of("wrong-hash").toHex();
        await request(app)
            .post(`/api/collection/${ collectionLocId }/${ itemId.toHex() }/files`)
            .field({ hash: wrongHash })
            .attach('file', buffer, { filename: FILE_NAME })
            .expect(400)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.errorMessage).toBe(`Received hash ${ wrongHash } does not match 0x1307990e6ba5ca145eb35e99182a9bec46531bc54ddf656a602c780fa0240dee`);
            });
    })

    it('fails to add file to collection item if already in DB', async () => {
        const app = setupApp(CollectionController, container => mockModel(container, {
            hasFile: true,
            fileAlreadyUploaded: true,
            collectionItemPublished: true,
            restrictedDelivery: false,
            fileType: "Item",
        }));
        const buffer = Buffer.from(SOME_DATA);
        await request(app)
            .post(`/api/collection/${ collectionLocId }/${ itemId.toHex() }/files`)
            .field({ hash: SOME_DATA_HASH.toHex() })
            .attach('file', buffer, { filename: FILE_NAME })
            .expect(400)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.errorMessage).toBe("File is already uploaded");
            });
    })

    it('fails to add file to a non-existing collection item', async () => {
        const app = setupApp(CollectionController, container => mockModel(container, {
            hasFile: false,
            fileAlreadyUploaded: false,
            collectionItemPublished: false,
            restrictedDelivery: false,
            fileType: "Item",
        }));
        const buffer = Buffer.from(SOME_DATA);
        await request(app)
            .post(`/api/collection/${ collectionLocId }/${ itemId.toHex() }/files`)
            .field({ hash: SOME_DATA_HASH.toHex() })
            .attach('file', buffer, { filename: FILE_NAME })
            .expect(400)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.errorMessage).toBe("Collection Item not found on chain");
            });
    })

    it('fails to add file to a non-existing collection item file', async () => {
        const app = setupApp(CollectionController, container => mockModel(container, {
            hasFile: false,
            fileAlreadyUploaded: false,
            collectionItemPublished: true,
            restrictedDelivery: false,
            fileType: "Item",
        }));
        const buffer = Buffer.from(SOME_DATA);
        await request(app)
            .post(`/api/collection/${ collectionLocId }/${ itemId.toHex() }/files`)
            .field({ hash: SOME_DATA_HASH.toHex() })
            .attach('file', buffer, { filename: FILE_NAME })
            .expect(400)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.errorMessage).toBe("Collection Item File not found");
            });
    })

    it('fails to add file if name does not match', async () => {
        const app = setupApp(CollectionController, container => mockModel(container, {
            hasFile: true,
            fileAlreadyUploaded: false,
            collectionItemPublished: true,
            restrictedDelivery: false,
            fileType: "Item",
        }));
        const buffer = Buffer.from(SOME_DATA);
        await request(app)
            .post(`/api/collection/${ collectionLocId }/${ itemId.toHex() }/files`)
            .field({ hash: SOME_DATA_HASH.toHex() })
            .attach('file', buffer, { filename: "WrongName.pdf" })
            .expect(400)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.errorMessage).toBe("Invalid name. Actually uploaded WrongName.pdf while expecting 'a-file.pdf'");
            });
    })

    const ownershipCheckParams = {
        fileAlreadyUploaded: false,
        restrictedDelivery: true,
        fileType: "Item" as FileType,
    };

    it('checks ownership', async () => {
        const app = setupApp(CollectionController, container => mockModel(container, {
            ...ownershipCheckParams,
            hasFile: true,
            collectionItemPublished: true,
            isOwner: true,
        }));
        await request(app)
            .get(`/api/collection/${ collectionLocId }/items/${ itemId.toHex() }/check`)
            .expect(200);
    })

    it('fails to check ownership when not owner', async () => {
        const app = setupApp(CollectionController, container => mockModel(container, {
            ...ownershipCheckParams,
            hasFile: true,
            collectionItemPublished: true,
            isOwner: false
        }));
        await request(app)
            .get(`/api/collection/${ collectionLocId }/items/${ itemId.toHex() }/check`)
            .expect(403);
    })

    it('fails to check ownership when item not published', async () => {
        const app = setupApp(CollectionController, container => mockModel(container, {
            ...ownershipCheckParams,
            hasFile: false,
            collectionItemPublished: false,
            isOwner: false
        }));
        await request(app)
            .get(`/api/collection/${ collectionLocId }/items/${ itemId.toHex() }/check`)
            .expect(400);
    })

})

type FileType = "Item" | "Collection";

function testDownloadFiles(fileType: FileType) {

    const url =
        fileType === "Item" ?
            `/api/collection/${ collectionLocId }/${ itemId.toHex() }/files/${ SOME_DATA_HASH.toHex() }` :
            `/api/collection/${ collectionLocId }/files/${ SOME_DATA_HASH.toHex() }/${ itemId.toHex() }`;

    it('fails to download existing file given its hash if no restricted delivery', async () => {
        const app = setupApp(CollectionController, container => mockModel(container, {
            hasFile: true,
            fileAlreadyUploaded: true,
            collectionItemPublished: true,
            restrictedDelivery: false,
            fileType,
        }));
        const filePath = CollectionController.tempFilePath({ collectionLocId, itemId, hash: SOME_DATA_HASH });
        await writeFile(filePath, SOME_DATA);
        await request(app)
            .get(url)
            .expect(403)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.errorMessage).toBe(`No delivery allowed for this ${ fileType.toLowerCase() }'s files`);
            });
    })

    it('fails to download non-existing file', async () => {
        const app = setupApp(CollectionController, container => mockModel(container, {
            hasFile: false,
            fileAlreadyUploaded: false,
            collectionItemPublished: true,
            restrictedDelivery: true,
            fileType,
        }));
        const filePath = CollectionController.tempFilePath({ collectionLocId, itemId, hash: SOME_DATA_HASH});
        await writeFile(filePath, SOME_DATA);
        await request(app)
            .get(url)
            .expect(400)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                if(fileType === "Collection") {
                    expect(response.body.errorMessage).toBe("File does not exist");
                } else {
                    expect(response.body.errorMessage).toBe("Trying to download a file that is not uploaded yet.");
                }
            });
    })

    it('fails to download from a non-existing file', async () => {
        const app = setupApp(CollectionController, container => mockModel(container, {
            hasFile: false,
            fileAlreadyUploaded: false,
            collectionItemPublished: false,
            restrictedDelivery: false,
            fileType,
        }));
        const filePath = CollectionController.tempFilePath({ collectionLocId, itemId, hash: SOME_DATA_HASH});
        await writeFile(filePath, SOME_DATA);
        await request(app)
            .get(url)
            .expect(400)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                if (fileType === "Item") {
                    expect(response.body.errorMessage).toBe("Collection item d61e2e12-6c06-4425-aeee-2a0e969ac14e not found on-chain");
                } else {
                    expect(response.body.errorMessage).toBe("File does not exist");
                }
            });
    })

    it('downloads existing file given its hash and is owner', async () => {
        const app = setupApp(CollectionController, container => mockModel(container, {
            hasFile: true,
            fileAlreadyUploaded: true,
            collectionItemPublished: true,
            restrictedDelivery: true,
            isOwner: true,
            fileType,
        }));
        const filePath = CollectionController.tempFilePath({ collectionLocId, itemId, hash: SOME_DATA_HASH});
        await writeFile(filePath, SOME_DATA);
        await request(app)
            .get(url)
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

    it('fails to download existing file given its hash and is not owner', async () => {
        const app = setupApp(CollectionController, container => mockModel(container, {
            hasFile: true,
            fileAlreadyUploaded: true,
            collectionItemPublished: true,
            restrictedDelivery: true,
            isOwner: false,
            fileType,
        }));
        const filePath = CollectionController.tempFilePath({ collectionLocId, itemId, hash: SOME_DATA_HASH});
        await writeFile(filePath, SOME_DATA);
        await request(app)
            .get(url)
            .expect(403)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.errorMessage).toBe("vQx5kESPn8dWyX4KxMCKqUyCaWUwtui1isX6PVNcZh2Ghjitr does not seem to be the owner of this item's underlying token");
            });
    })
}

describe("CollectionController - item files - ", () => {

    testDownloadFiles("Item");

    it('retrieves latest deliveries info', async () => {
        const app = setupApp(CollectionController, container => mockModel(container, {
            hasFile: true,
            fileAlreadyUploaded: true,
            collectionItemPublished: true,
            restrictedDelivery: true,
            isOwner: true,
            fileType: "Item",
        }));
        await request(app)
            .get(`/api/collection/${ collectionLocId }/${ itemId.toHex() }/latest-deliveries`)
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .then(response => expectDeliveryInfo(response.body[SOME_DATA_HASH.toHex()][0]));
    })

    it('retrieves deliveries info', async () => {
        const app = setupApp(CollectionController, container => mockModel(container, {
            hasFile: true,
            fileAlreadyUploaded: true,
            collectionItemPublished: true,
            restrictedDelivery: true,
            isOwner: true,
            fileType: "Item",
        }));
        await request(app)
            .get(`/api/collection/${ collectionLocId }/${ itemId.toHex() }/all-deliveries`)
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .then(response => expectDeliveryInfo(response.body[SOME_DATA_HASH.toHex()][0]));
    })

    it('downloads existing file source given its hash and is owner', async () => {
        const mock = mockAuthenticationWithAuthenticatedUser(mockAuthenticatedUser(true, collectionLocOwner));
        const app = setupApp(CollectionController, container => mockModel(container, {
            hasFile: true,
            fileAlreadyUploaded: true,
            collectionItemPublished: true,
            restrictedDelivery: true,
            isOwner: true,
            fileType: "Item",
        }), mock);
        const filePath = CollectionController.tempFilePath({ collectionLocId, itemId, hash: SOME_DATA_HASH});
        await writeFile(filePath, SOME_DATA);
        await request(app)
            .get(`/api/collection/${ collectionLocId }/${ itemId.toHex() }/files/${ SOME_DATA_HASH.toHex() }/source`)
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
})

describe("CollectionController - collection files - ", () => {

    testDownloadFiles("Collection");

    const mockParams = {
        fileAlreadyUploaded: true,
        hasFile: true,
        collectionItemPublished: true,
        restrictedDelivery: true,
        isOwner: true,
        fileType: "Collection" as FileType,
    };

    it('updates restricted delivery flag', async () => {
        const app = setupApp(CollectionController, container => mockModel(container, mockParams));
        await request(app)
            .put(`/api/collection/${ collectionLocId }/files/${ SOME_DATA_HASH.toHex() }`)
            .send({ restrictedDelivery: true })
            .expect(200)
    })

    it('retrieves deliveries info', async () => {
        const app = setupApp(CollectionController, container => mockModel(container, mockParams));
        await request(app)
            .get(`/api/collection/${ collectionLocId }/file-deliveries/${ SOME_DATA_HASH.toHex() }`)
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                const delivery = response.body.deliveries[0];
                checkDelivery(delivery);
            });
    })

    it('retrieves all deliveries info', async () => {
        const app = setupApp(CollectionController, container => mockModel(container, mockParams));
        await request(app)
            .get(`/api/collection/${ collectionLocId }/file-deliveries`)
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                const delivery = response.body[SOME_DATA_HASH.toHex()][0];
                checkDelivery(delivery);
            });
    })

    it('checks one delivery hash', async () => {
        const app = setupApp(CollectionController, container => mockModel(container, mockParams));
        await request(app)
            .put(`/api/collection/${ collectionLocId }/file-deliveries`)
            .send({
                copyHash: DELIVERY_HASH.toHex()
            })
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                checkDelivery(response.body, SOME_DATA_HASH);
            });
    })


    it('fails to check delivery with wrong hash', async () => {
        const app = setupApp(CollectionController, container => mockModel(container, mockParams));
        await request(app)
            .put(`/api/collection/${ collectionLocId }/file-deliveries`)
            .send({
                copyHash: Hash.of("wrong hash").toHex()
            })
            .expect(400)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.errorMessage).toEqual("Provided copyHash is not from a delivered copy of a file from the collection")
            });
    })

    function checkDelivery(delivery: any, originalFileHash?: Hash) {
        expect(delivery.copyHash).toBe(DELIVERY_HASH.toHex());
        expect(delivery.generatedOn).toBeDefined();
        expect(delivery.owner).toBe(ITEM_TOKEN_OWNER);
        expect(delivery.originalFileHash).toBe(originalFileHash?.toHex());
    }
})

function mockModelForGet(container: Container, collectionItemPublished: boolean): void {
    return mockModel(container, {
        collectionItemPublished,
        hasFile: true,
        fileAlreadyUploaded: true,
        restrictedDelivery: false,
        fileType: "Item"
    });
}

function mockModel(
    container: Container,
    params: {
        fileAlreadyUploaded: boolean,
        collectionItemPublished: boolean,
        hasFile: boolean,
        restrictedDelivery: boolean,
        isOwner?: boolean,
        fileType: FileType,
    }): void {
    const { hasFile, fileAlreadyUploaded, collectionItemPublished, restrictedDelivery, isOwner, fileType } = params;
    const collectionItem = new CollectionItemAggregateRoot();
    const collectionLoc = new LocRequestAggregateRoot();
    collectionLoc.id = collectionLocId;
    collectionItem.collectionLocId = collectionLocId;
    collectionItem.itemId = itemId.toHex();
    collectionItem.addedOn = timestamp.toDate();
    collectionItem.token = new CollectionItemToken();
    collectionItem.token.id = TOKEN_ID;
    collectionItem.token.type = TOKEN_TYPE;
    if (fileType === "Item") {
        const collectionItemFile = new CollectionItemFile()
        collectionItemFile.collectionLocId = collectionLocId;
        collectionItemFile.itemId = itemId.toHex();
        collectionItemFile.hash = SOME_DATA_HASH.toHex();
        collectionItemFile.name = FILE_NAME;
        collectionItemFile.contentType = CONTENT_TYPE;
        if(hasFile && fileAlreadyUploaded) {
            collectionItemFile.cid = CID;
        }
        collectionItemFile.collectionItem = collectionItem;
        collectionItem.files = [ collectionItemFile ];

        collectionLoc.files = [];
    } else if (hasFile && fileType === "Collection") {
        const collectionFile = new LocFile();
        collectionFile.lifecycle = EmbeddableLifecycle.fromSubmissionType("MANUAL_BY_OWNER");
        collectionFile.hash = SOME_DATA_HASH.toHex();
        if(fileAlreadyUploaded) {
            collectionFile.cid = CID;
        }
        collectionFile.request = collectionLoc;
        collectionFile.requestId = collectionLocId;
        collectionFile.submitter = EmbeddableAccountId.from(collectionRequester);
        collectionFile.index = 0;
        collectionFile.name = FILE_NAME;
        collectionFile.contentType = CONTENT_TYPE;
        collectionFile.restrictedDelivery = restrictedDelivery;
        collectionLoc.files = [ collectionFile ];

        collectionItem.files = [];
    } else {
        collectionLoc.files = [];
        collectionItem.files = [];
    }
    const collectionItemFile = new Mock<CollectionItemFile>()
    const collectionRepository = new Mock<CollectionRepository>()
    const locRequestRepository = new Mock<LocRequestRepository>();
    if (collectionItemPublished) {
        collectionRepository.setup(instance => instance.findBy(collectionLocId, ItIsHash(itemId)))
            .returns(Promise.resolve(collectionItem))
        collectionRepository.setup(instance => instance.findAllBy(collectionLocId))
            .returns(Promise.resolve([ collectionItem ]))
    } else {
        collectionRepository.setup(instance => instance.findBy(collectionLocId, ItIsHash(itemId)))
            .returns(Promise.resolve(null))
        collectionRepository.setup(instance => instance.findAllBy(collectionLocId))
            .returns(Promise.resolve([]))
    }
    collectionRepository.setup(instance => instance.save(collectionItem)).returnsAsync();
    if(restrictedDelivery && fileType === "Item") {
        const delivered: CollectionItemFileDelivered = {
            collectionLocId,
            itemId: itemId.toHex(),
            hash: SOME_DATA_HASH.toHex(),
            deliveredFileHash: DELIVERY_HASH.toHex(),
            generatedOn: new Date(),
            owner: ITEM_TOKEN_OWNER,
            collectionItemFile: collectionItemFile.object(),
        };

        collectionRepository.setup(instance => instance.findLatestDelivery(
            It.Is<{ collectionLocId: string, itemId: Hash, fileHash: Hash }>(query =>
                query.collectionLocId === collectionLocId
                && query.itemId.equalTo(itemId)
                && query.fileHash.equalTo(SOME_DATA_HASH)
            ))
        ).returnsAsync(delivered);

        collectionRepository.setup(instance => instance.findLatestDeliveries(
            It.Is<{ collectionLocId: string, itemId: Hash }>(query =>
                query.collectionLocId === collectionLocId
                && query.itemId.equalTo(itemId)
            ))
        ).returnsAsync({
            [ SOME_DATA_HASH.toHex() ]: [ delivered ]
        });
    } else if (restrictedDelivery && fileType === "Collection") {
        const fileDelivered: LocFileDelivered[] = [ {
            requestId: collectionLocId,
            hash: SOME_DATA_HASH.toHex(),
            deliveredFileHash: DELIVERY_HASH.toHex(),
            generatedOn: new Date(),
            owner: ITEM_TOKEN_OWNER,
        } ]
        const delivered: Record<string, LocFileDelivered[]> = {};
        delivered[SOME_DATA_HASH.toHex()] = fileDelivered;
        locRequestRepository.setup(instance => instance.findAllDeliveries(
            It.Is<{ collectionLocId: string, hash: Hash }>(query =>
                query.collectionLocId === collectionLocId &&
                query.hash.equalTo(SOME_DATA_HASH) ))
        ).returnsAsync(delivered);
        locRequestRepository.setup(instance => instance.findAllDeliveries(
            It.Is<{ collectionLocId: string, hash: string }>(query =>
                query.collectionLocId === collectionLocId &&
                query.hash === undefined ))
        ).returnsAsync(delivered);
        locRequestRepository.setup(instance => instance.findDeliveryByDeliveredFileHash(
            It.Is<{ collectionLocId: string, deliveredFileHash: Hash }>(query =>
                query.collectionLocId === collectionLocId &&
                query.deliveredFileHash.equalTo(DELIVERY_HASH)
            ))
        ).returnsAsync(fileDelivered[0]);
        locRequestRepository.setup(instance => instance.findDeliveryByDeliveredFileHash(
            It.Is<{ collectionLocId: string, deliveredFileHash: Hash }>(query =>
                query.collectionLocId !== collectionLocId ||
                !query.deliveredFileHash.equalTo(DELIVERY_HASH)
            ))
        ).returnsAsync(null);
    }
    container.bind(CollectionRepository).toConstantValue(collectionRepository.object())

    collectionLoc.ownerAddress = collectionLocOwner.address;
    collectionLoc.requester = EmbeddableNullableAccountId.from(collectionRequester);
    collectionLoc.locType = "Collection";
    collectionLoc.status = "CLOSED";
    locRequestRepository.setup(instance => instance.findById(collectionLocId))
        .returns(Promise.resolve(collectionLoc))
    locRequestRepository.setup(instance => instance.save(It.IsAny<LocRequestAggregateRoot>()))
        .returns(Promise.resolve())
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
        name: Hash.of(FILE_NAME),
        contentType: Hash.of(CONTENT_TYPE),
        size: BigInt(SOME_DATA.length)
    }

    const publishedCollectionItem: CollectionItem = {
        id: itemId,
        description: Hash.of("Item Description"),
        files: [ publishedCollectionItemFile ],
        restrictedDelivery,
        termsAndConditions: [],
        token: {
            id: Hash.of(TOKEN_ID),
            type: Hash.of(TOKEN_TYPE),
            issuance: 1n,
        }
    }
    const logionNodeCollectionService = new Mock<LogionNodeCollectionService>();
    logionNodeCollectionService.setup(instance => instance.getCollectionItem(It.Is<GetCollectionItemParams>(
        param => param.collectionLocId === collectionLocId && param.itemId.equalTo(itemId))
    ))
        .returns(Promise.resolve(collectionItemPublished ? publishedCollectionItem : undefined));
    logionNodeCollectionService.setup(instance => instance.getCollectionItemFile(It.Is<GetCollectionItemFileParams>(
        param => param.collectionLocId === collectionLocId && param.itemId.equalTo(itemId) && param.hash.equalTo(SOME_DATA_HASH))
    ))
        .returns(Promise.resolve(hasFile ? publishedCollectionItemFile : undefined));
    container.bind(LogionNodeCollectionService).toConstantValue(logionNodeCollectionService.object());

    const ownershipCheckService = new Mock<OwnershipCheckService>();
    if(restrictedDelivery) {
        ownershipCheckService.setup(instance => instance.isOwner(It.IsAny(), It.IsAny())).returnsAsync(isOwner || false);
    }
    container.bind(OwnershipCheckService).toConstantValue(ownershipCheckService.object());

    const restrictedDeliveryService = new Mock<RestrictedDeliveryService>();
    restrictedDeliveryService.setup(instance => instance.setMetadata(It.IsAny())).returnsAsync();
    container.bind(RestrictedDeliveryService).toConstantValue(restrictedDeliveryService.object());

    container.bind(CollectionService).toConstantValue(new NonTransactionalCollectionService(collectionRepository.object()));

    container.bind(LocRequestService).toConstantValue(new NonTransactionalLocRequestService(locRequestRepository.object()));
}

const TOKEN_ID = "some-token-id";
const TOKEN_TYPE = "owner";

function expectDeliveryInfo(responseBody: any) {
    expect(responseBody.copyHash).toBe(DELIVERY_HASH.toHex());
    expect(responseBody.generatedOn).toBeDefined();
    expect(responseBody.owner).toBe(ITEM_TOKEN_OWNER);
    expect(responseBody.belongsToCurrentOwner).toBe(true);
}
