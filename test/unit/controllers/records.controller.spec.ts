import { TestApp } from "@logion/rest-api-core";
import { Container } from "inversify";
import { Mock, It } from "moq.ts";
import {
    TypesTokensRecord as ChainTokensRecord,
    TypesTokensRecordFile as ChainTokensRecordFile,
    Hash,
    ValidAccountId
} from "@logion/node-api";
import { writeFile } from "fs/promises";
import moment from "moment";
import request from "supertest";
import {
    LocRequestAggregateRoot,
    LocRequestRepository,
} from "../../../src/logion/model/locrequest.model.js";
import { FileStorageService } from "../../../src/logion/services/file.storage.service.js";
import { fileExists } from "../../helpers/filehelper.js";
import { OwnershipCheckService } from "../../../src/logion/services/ownershipcheck.service.js";
import { RestrictedDeliveryService } from "../../../src/logion/services/restricteddelivery.service.js";
import { ALICE_ACCOUNT } from "../../helpers/addresses.js";
import { TokensRecordController } from "../../../src/logion/controllers/records.controller.js";
import {
    TokensRecordRepository,
    TokensRecordFactory,
    TokensRecordAggregateRoot,
    TokensRecordFileDelivered,
    TokensRecordFile
} from "../../../src/logion/model/tokensrecord.model.js";
import { GetTokensRecordFileParams, GetTokensRecordParams, LogionNodeTokensRecordService, NonTransactionalTokensRecordService, TokensRecordService } from "../../../src/logion/services/tokensrecord.service.js";
import { LocAuthorizationService } from "../../../src/logion/services/locauthorization.service.js";
import { CollectionItemAggregateRoot, CollectionItemDescription, CollectionRepository } from "../../../src/logion/model/collection.model.js";
import { ItIsHash } from "../../helpers/Mock.js";
import { DB_SS58_PREFIX, EmbeddableNullableAccountId } from "../../../src/logion/model/supportedaccountid.model.js";

const collectionLocId = "d61e2e12-6c06-4425-aeee-2a0e969ac14e";
const collectionLocOwner = ALICE_ACCOUNT;
const collectionRequester = ValidAccountId.polkadot("5EBxoSssqNo23FvsDeUxjyQScnfEiGxJaNwuwqBH2Twe35BX");
const itemId = Hash.fromHex("0x818f1c9cd44ed4ca11f2ede8e865c02a82f9f8a158d8d17368a6818346899705");
const timestamp = moment();

const ITEM_TOKEN_OWNER = "0x900edc98db53508e6742723988B872dd08cd09c3";

const recordId = Hash.fromHex("0x59772b9c70d6cc244274937445f7c5b56ec6fe0a11292c4ed68848655515a1e6");
const recordSubmitter = ValidAccountId.polkadot("5FniDvPw22DMW1TLee9N8zBjzwKXaKB2DcvZZCQU5tjmv1kb");
const SOME_DATA = 'some data';
const SOME_DATA_HASH = Hash.fromHex('0x1307990e6ba5ca145eb35e99182a9bec46531bc54ddf656a602c780fa0240dee');
const FILE_NAME = "'a-file.pdf'";
const CID = "cid-784512";
const CONTENT_TYPE = "text/plain";
const DELIVERY_HASH = Hash.fromHex('0xf35e4bcbc1b0ce85af90914e04350cce472a2f01f00c0f7f8bc5c7ba04da2bf2');

const { setupApp, mockAuthenticationWithAuthenticatedUser, mockAuthenticatedUser } = TestApp;

describe("TokensRecordController", () => {

    it("gets all records in a collection", async () => {

        const app = setupApp(TokensRecordController, container => mockModelForGet(container, true));

        await request(app)
            .get(`/api/records/${ collectionLocId }`)
            .send()
            .expect(200)
            .then(response => {
                expect(response.body.records.length).toBe(1)
            })
    })

    it("gets an existing tokens record in DB", async () => {

        const app = setupApp(TokensRecordController, container => mockModelForGet(container, true));

        await request(app)
            .get(`/api/records/${ collectionLocId }/record/${ recordId.toHex() }`)
            .send()
            .expect(200)
            .then(response => {
                expect(response.body.collectionLocId).toEqual(collectionLocId)
                expect(response.body.recordId).toEqual(recordId.toHex())
                expect(response.body.addedOn).toEqual(timestamp.toISOString())
                expect(response.body.files[0].hash).toEqual(SOME_DATA_HASH.toHex())
            })
    })

    it("gets a tokens record existing on Chain only", async () => {

        const app = setupApp(TokensRecordController, container => mockModelForGet(container, false));

        await request(app)
            .get(`/api/records/${ collectionLocId }/record/${ recordId.toHex() }`)
            .send()
            .expect(200)
            .then(response => {
                expect(response.body.collectionLocId).toEqual(collectionLocId)
                expect(response.body.recordId).toEqual(recordId.toHex())
                expect(response.body.addedOn).toBeUndefined()
                expect(response.body.files).toEqual([])
            })
    })

    it("gets an error code when requesting non-existent tokens record", async () => {

        const app = setupApp(TokensRecordController, container => mockModelForGet(container, false));

        const nonExistant = Hash.of("non-existent");
        await request(app)
            .get(`/api/records/${ collectionLocId }/record/${ nonExistant.toHex() }`)
            .send()
            .expect(400)
            .then(response => {
                expect(response.body.errorMessage).toEqual(`Tokens Record d61e2e12-6c06-4425-aeee-2a0e969ac14e/${ nonExistant } not found`)
            })
    })

    it('uploads file to tokens record', async () => {
        const app = setupApp(TokensRecordController, container => mockModel(container, {
            recordAlreadyInDB: true,
            fileAlreadyInDB: false,
            recordPublished: true,
            filePublished: true,
        }));
        const buffer = Buffer.from(SOME_DATA);
        await request(app)
            .post(`/api/records/${ collectionLocId }/${ recordId.toHex() }/files`)
            .field({ hash: SOME_DATA_HASH.toHex() })
            .attach('file', buffer, { filename: FILE_NAME })
            .expect(200);
    })

    it('fails to add file to tokens record if wrong hash', async () => {
        const app = setupApp(TokensRecordController, container => mockModel(container, {
            recordAlreadyInDB: true,
            fileAlreadyInDB: true,
            recordPublished: true,
            filePublished: true,
        }));
        const buffer = Buffer.from(SOME_DATA);
        const wrongHash = Hash.of("wrong-hash").toHex();
        await request(app)
            .post(`/api/records/${ collectionLocId }/${ recordId.toHex() }/files`)
            .field({ hash: wrongHash })
            .attach('file', buffer, { filename: FILE_NAME })
            .expect(400)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.errorMessage).toBe(`Received hash ${ wrongHash } does not match 0x1307990e6ba5ca145eb35e99182a9bec46531bc54ddf656a602c780fa0240dee`);
            });
    })

    it('fails to add file to tokens record if already in DB', async () => {
        const app = setupApp(TokensRecordController, container => mockModel(container, {
            recordAlreadyInDB: true,
            fileAlreadyInDB: true,
            recordPublished: true,
            filePublished: true,
        }));
        const buffer = Buffer.from(SOME_DATA);
        await request(app)
            .post(`/api/records/${ collectionLocId }/${ recordId.toHex() }/files`)
            .field({ hash: SOME_DATA_HASH.toHex() })
            .attach('file', buffer, { filename: FILE_NAME })
            .expect(400)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.errorMessage).toBe("File is already uploaded");
            });
    })

    it('fails to add file to a non-existing tokens record', async () => {
        const app = setupApp(TokensRecordController, container => mockModel(container, {
            recordAlreadyInDB: true,
            fileAlreadyInDB: false,
            recordPublished: false,
            filePublished: false,
        }));
        const buffer = Buffer.from(SOME_DATA);
        await request(app)
            .post(`/api/records/${ collectionLocId }/${ recordId.toHex() }/files`)
            .field({ hash: SOME_DATA_HASH.toHex() })
            .attach('file', buffer, { filename: FILE_NAME })
            .expect(400)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.errorMessage).toBe("Tokens Record not found on chain");
            });
    })

    it('fails to add file to a non-existing tokens record file', async () => {
        const app = setupApp(TokensRecordController, container => mockModel(container, {
            recordAlreadyInDB: true,
            fileAlreadyInDB: false,
            recordPublished: true,
            filePublished: false,
        }));
        const buffer = Buffer.from(SOME_DATA);
        await request(app)
            .post(`/api/records/${ collectionLocId }/${ recordId.toHex() }/files`)
            .field({ hash: SOME_DATA_HASH.toHex() })
            .attach('file', buffer, { filename: FILE_NAME })
            .expect(400)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.errorMessage).toBe("Tokens Record File not found");
            });
    })

    it('fails to add file if name does not match', async () => {
        const app = setupApp(TokensRecordController, container => mockModel(container, {
            recordAlreadyInDB: true,
            fileAlreadyInDB: false,
            recordPublished: true,
            filePublished: true,
        }));
        const buffer = Buffer.from(SOME_DATA);
        await request(app)
            .post(`/api/records/${ collectionLocId }/${ recordId.toHex() }/files`)
            .field({ hash: SOME_DATA_HASH.toHex() })
            .attach('file', buffer, { filename: "WrongName.pdf" })
            .expect(400)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.errorMessage).toBe("Invalid name. Actually uploaded WrongName.pdf while expecting 'a-file.pdf'");
            });
    });

    const downloadUrl = `/api/records/${ collectionLocId }/${ recordId.toHex() }/files/${ SOME_DATA_HASH.toHex() }/${ itemId.toHex() }`;

    it('fails to download non-existing file', async () => {
        const app = setupApp(TokensRecordController, container => mockModel(container, {
            recordAlreadyInDB: true,
            fileAlreadyInDB: false,
            recordPublished: true,
            filePublished: true,
        }));
        const filePath = TokensRecordController.tempFilePath({ collectionLocId, recordId, hash: SOME_DATA_HASH});
        await writeFile(filePath, SOME_DATA);
        await request(app)
            .get(downloadUrl)
            .expect(400)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.errorMessage).toBe("Trying to download a file that is not uploaded yet.");
            });
    })

    it('fails to download from a non-existing file', async () => {
        const app = setupApp(TokensRecordController, container => mockModel(container, {
            recordAlreadyInDB: true,
            fileAlreadyInDB: false,
            recordPublished: false,
            filePublished: false,
        }));
        const filePath = TokensRecordController.tempFilePath({ collectionLocId, recordId, hash: SOME_DATA_HASH});
        await writeFile(filePath, SOME_DATA);
        await request(app)
            .get(downloadUrl)
            .expect(400)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.errorMessage).toBe("Trying to download a file that is not uploaded yet.");
            });
    })

    it('downloads existing file given its hash and is owner', async () => {
        const app = setupApp(TokensRecordController, container => mockModel(container, {
            recordAlreadyInDB: true,
            fileAlreadyInDB: true,
            recordPublished: true,
            filePublished: true,
            isOwner: true,
        }));
        const filePath = TokensRecordController.tempFilePath({ collectionLocId, recordId, hash: SOME_DATA_HASH});
        await writeFile(filePath, SOME_DATA);
        await request(app)
            .get(downloadUrl)
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
        const app = setupApp(TokensRecordController, container => mockModel(container, {
            recordAlreadyInDB: true,
            fileAlreadyInDB: true,
            recordPublished: true,
            filePublished: true,
            isOwner: false,
        }));
        const filePath = TokensRecordController.tempFilePath({ collectionLocId, recordId, hash: SOME_DATA_HASH});
        await writeFile(filePath, SOME_DATA);
        await request(app)
            .get(downloadUrl)
            .expect(403)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.errorMessage).toBe("vQx5kESPn8dWyX4KxMCKqUyCaWUwtui1isX6PVNcZh2Ghjitr does not seem to be the owner of related item's underlying token");
            });
    })

    it('retrieves deliveries info', async () => {
        const app = setupApp(TokensRecordController, container => mockModel(container, {
            recordAlreadyInDB: true,
            fileAlreadyInDB: true,
            recordPublished: true,
            filePublished: true,
            isOwner: true,
        }));
        await request(app)
            .get(`/api/records/${ collectionLocId }/${ recordId.toHex() }/deliveries`)
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .then(response => expectDeliveryInfo(response.body[SOME_DATA_HASH.toHex()][0]));
    })

    it('downloads existing file source given its hash and is owner', async () => {
        const mock = mockAuthenticationWithAuthenticatedUser(mockAuthenticatedUser(true, collectionLocOwner));
        const app = setupApp(TokensRecordController, container => mockModel(container, {
            recordAlreadyInDB: true,
            fileAlreadyInDB: true,
            recordPublished: true,
            filePublished: true,
            isOwner: true,
        }), mock);
        const filePath = TokensRecordController.tempFilePath({ collectionLocId, recordId, hash: SOME_DATA_HASH});
        await writeFile(filePath, SOME_DATA);
        await request(app)
            .get(`/api/records/${ collectionLocId }/${ recordId.toHex() }/files-sources/${ SOME_DATA_HASH.toHex() }`)
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

function mockModelForGet(container: Container, collectionItemAlreadyInDB: boolean): void {
    return mockModel(container, { recordAlreadyInDB: collectionItemAlreadyInDB, fileAlreadyInDB: true, recordPublished: true, filePublished: true })
}

function mockModel(
    container: Container,
    params: {
        recordAlreadyInDB: boolean,
        fileAlreadyInDB: boolean,
        recordPublished: boolean,
        filePublished: boolean,
        isOwner?: boolean,
    }): void {
    const { recordAlreadyInDB, fileAlreadyInDB, recordPublished, filePublished, isOwner } = params;
    const tokensRecord = new TokensRecordAggregateRoot()
    const collectionLoc = new LocRequestAggregateRoot();
    collectionLoc.id = collectionLocId;
    tokensRecord.collectionLocId = collectionLocId;
    tokensRecord.recordId = recordId.toHex();
    tokensRecord.addedOn = timestamp.toDate();
    const tokensRecordFile = new TokensRecordFile();
    tokensRecordFile.collectionLocId = collectionLocId;
    tokensRecordFile.recordId = recordId.toHex();
    tokensRecordFile.hash = SOME_DATA_HASH.toHex();
    tokensRecordFile.name = FILE_NAME;
    tokensRecordFile.contentType = CONTENT_TYPE;
    tokensRecordFile.tokenRecord = tokensRecord;
    tokensRecord.files = [ tokensRecordFile ];
    if (fileAlreadyInDB) {
        tokensRecordFile.cid = CID;
    }
    const tokensRecordRepository = new Mock<TokensRecordRepository>()
    const locRequestRepository = new Mock<LocRequestRepository>();
    if (recordAlreadyInDB) {
        tokensRecordRepository.setup(instance => instance.findBy(collectionLocId, ItIsHash(recordId)))
            .returns(Promise.resolve(tokensRecord))
        tokensRecordRepository.setup(instance => instance.findAllBy(collectionLocId))
            .returns(Promise.resolve([ tokensRecord ]))
    } else {
        tokensRecordRepository.setup(instance => instance.findBy(collectionLocId, ItIsHash(recordId)))
            .returns(Promise.resolve(null))
        tokensRecordRepository.setup(instance => instance.findAllBy(collectionLocId))
            .returns(Promise.resolve([]))
    }
    tokensRecordRepository.setup(instance => instance.save(tokensRecord)).returnsAsync();

    const delivered: TokensRecordFileDelivered = {
        collectionLocId,
        recordId: recordId.toHex(),
        hash: SOME_DATA_HASH.toHex(),
        deliveredFileHash: DELIVERY_HASH.toHex(),
        generatedOn: new Date(),
        owner: ITEM_TOKEN_OWNER,
        tokensRecordFile: tokensRecordFile,
    };

    tokensRecordRepository.setup(instance => instance.findLatestDelivery(
        It.Is<{ collectionLocId: string, recordId: Hash, fileHash: Hash }>(query =>
            query.collectionLocId === collectionLocId
            && query.recordId.equalTo(recordId)
            && query.fileHash.equalTo(SOME_DATA_HASH)
        ))
    ).returnsAsync(delivered);

    tokensRecordRepository.setup(instance => instance.findLatestDeliveries(
        It.Is<{ collectionLocId: string, recordId: Hash }>(query =>
            query.collectionLocId === collectionLocId
            && query.recordId.equalTo(recordId)
        ))
    ).returnsAsync({
        [ SOME_DATA_HASH.toHex() ]: [ delivered ]
    });

    container.bind(TokensRecordRepository).toConstantValue(tokensRecordRepository.object())

    collectionLoc.ownerAddress = collectionLocOwner.getAddress(DB_SS58_PREFIX);
    collectionLoc.requester = EmbeddableNullableAccountId.from(collectionRequester);
    collectionLoc.locType = "Collection";
    collectionLoc.status = "CLOSED";
    locRequestRepository.setup(instance => instance.findById(collectionLocId))
        .returns(Promise.resolve(collectionLoc))
    locRequestRepository.setup(instance => instance.save(It.IsAny<LocRequestAggregateRoot>()))
        .returns(Promise.resolve())
    container.bind(LocRequestRepository).toConstantValue(locRequestRepository.object())

    const tokensRecordFactory = new Mock<TokensRecordFactory>()
    container.bind(TokensRecordFactory).toConstantValue(tokensRecordFactory.object())

    const fileStorageService = new Mock<FileStorageService>()
    const filePath = TokensRecordController.tempFilePath({ collectionLocId, recordId, hash: SOME_DATA_HASH });
    fileStorageService.setup(instance => instance.importFile(filePath, collectionLocOwner))
        .returns(Promise.resolve(CID))
    fileStorageService.setup(instance => instance.exportFile({ cid: CID }, filePath, collectionLocOwner))
        .returns(Promise.resolve())
    container.bind(FileStorageService).toConstantValue(fileStorageService.object())

    const publishedCollectionItem = new Mock<CollectionItemAggregateRoot>();
    const itemDescripiton: CollectionItemDescription = {
        collectionLocId,
        itemId,
        description: "Item Description",
        files: [],
        termsAndConditions: [],
        token: {
            id: "some-id",
            type: "owner"
        }
    }
    publishedCollectionItem.setup(instance => instance.getDescription()).returns(itemDescripiton);
    const collectionRepository = new Mock<CollectionRepository>();
    collectionRepository.setup(instance => instance.findBy(collectionLocId, ItIsHash(itemId)))
        .returns(Promise.resolve(publishedCollectionItem.object()));
    container.bind(CollectionRepository).toConstantValue(collectionRepository.object());

    const publishedTokensRecordFile: ChainTokensRecordFile = {
        hash: SOME_DATA_HASH,
        name: Hash.of(FILE_NAME),
        contentType: Hash.of(CONTENT_TYPE),
        size: SOME_DATA.length.toString(),
    };
    const publishedTokensRecord: ChainTokensRecord = {
        description: Hash.of("Item Description"),
        files: [],
        submitter: recordSubmitter,
    }
    if(filePublished) {
        publishedTokensRecord.files.push(publishedTokensRecordFile);
    }
    const logionNodeTokensRecordService = new Mock<LogionNodeTokensRecordService>();
    logionNodeTokensRecordService.setup(instance => instance.getTokensRecord(It.Is<GetTokensRecordParams>(
        param => param.collectionLocId === collectionLocId && param.recordId.equalTo(recordId))
    ))
        .returns(Promise.resolve(recordPublished ? publishedTokensRecord : undefined));
        logionNodeTokensRecordService.setup(instance => instance.getTokensRecordFile(It.Is<GetTokensRecordFileParams>(
        param => param.collectionLocId === collectionLocId && param.recordId.equalTo(recordId) && param.hash.equalTo(SOME_DATA_HASH))
    ))
        .returns(Promise.resolve(filePublished ? publishedTokensRecordFile : undefined));
    container.bind(LogionNodeTokensRecordService).toConstantValue(logionNodeTokensRecordService.object());

    const ownershipCheckService = new Mock<OwnershipCheckService>();
    ownershipCheckService.setup(instance => instance.isOwner(It.IsAny(), It.IsAny())).returnsAsync(isOwner || false);
    container.bind(OwnershipCheckService).toConstantValue(ownershipCheckService.object());

    const restrictedDeliveryService = new Mock<RestrictedDeliveryService>();
    restrictedDeliveryService.setup(instance => instance.setMetadata(It.IsAny())).returnsAsync();
    container.bind(RestrictedDeliveryService).toConstantValue(restrictedDeliveryService.object());

    container.bind(TokensRecordService).toConstantValue(new NonTransactionalTokensRecordService(tokensRecordRepository.object()));

    const locAuthorityService = new Mock<LocAuthorizationService>();
    locAuthorityService.setup(instance => instance.ensureContributor(It.IsAny())).returnsAsync(ALICE_ACCOUNT);
    locAuthorityService.setup(instance => instance.isContributor(It.IsAny(), It.IsAny())).returnsAsync(true);
    container.bind(LocAuthorizationService).toConstantValue(locAuthorityService.object());
}

function expectDeliveryInfo(responseBody: any) {
    expect(responseBody.copyHash).toBe(DELIVERY_HASH.toHex());
    expect(responseBody.generatedOn).toBeDefined();
    expect(responseBody.owner).toBe(ITEM_TOKEN_OWNER);
}
