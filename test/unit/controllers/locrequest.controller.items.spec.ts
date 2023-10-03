import { TestApp } from "@logion/rest-api-core";
import { Hash } from "@logion/node-api";
import { Express } from 'express';
import { writeFile } from 'fs/promises';
import { LocRequestController } from "../../../src/logion/controllers/locrequest.controller.js";
import { Container } from "inversify";
import request from "supertest";
import { BOB, ALICE_ACCOUNT, ALICE } from "../../helpers/addresses.js";
import { Mock, It } from "moq.ts";
import {
    LocRequestAggregateRoot,
    LinkDescription,
    MetadataItemDescription, FileDescription, SubmissionType,
} from "../../../src/logion/model/locrequest.model.js";
import { fileExists } from "../../helpers/filehelper.js";
import {
    buildMocksForUpdate,
    mockPolkadotIdentityLoc,
    mockRequest,
    REQUEST_ID,
    setupRequest,
    setupSelectedIssuer,
    SetupIssuerMode,
    testData,
    ISSUER,
    setUpVote,
    mockRequester, mockOwner
} from "./locrequest.controller.shared.js";
import { mockAuthenticationForUserOrLegalOfficer } from "@logion/rest-api-core/dist/TestApp.js";
import {
    polkadotAccount,
    SupportedAccountId,
    accountEquals
} from "../../../src/logion/model/supportedaccountid.model.js";
import { ItIsAccount, ItIsHash } from "../../helpers/Mock.js";

const { mockAuthenticationWithCondition, setupApp } = TestApp;

describe('LocRequestController - Items -', () => {

    it('adds file to loc', async () => {
        const locRequest = new Mock<LocRequestAggregateRoot>();
        mockOwner(locRequest, ALICE_ACCOUNT);
        mockRequester(locRequest, REQUESTER);
        const app = setupApp(LocRequestController, container => mockModelForAddFile(container, locRequest, 'NOT_ISSUER'));
        await testAddFileSuccess(app, locRequest, "MANUAL_BY_OWNER");
    })

    it('adds file to loc - verified issuer', async () => {
        const authenticatedUserMock = mockAuthenticationForUserOrLegalOfficer(false, ISSUER.address);
        const locRequest = new Mock<LocRequestAggregateRoot>();
        const app = setupApp(LocRequestController, container => mockModelForAddFile(container, locRequest, 'SELECTED'), authenticatedUserMock);
        await testAddFileSuccess(app, locRequest, "MANUAL_BY_USER");
    })

    it('fails to add file to loc with wrong hash', async () => {
        const locRequest = new Mock<LocRequestAggregateRoot>();
        mockOwner(locRequest, ALICE_ACCOUNT);
        mockRequester(locRequest, REQUESTER);
        const app = setupApp(LocRequestController, container => mockModelForAddFile(container, locRequest, 'NOT_ISSUER'));
        const buffer = Buffer.from(SOME_DATA);
        const wrongHash = Hash.of("wrong-hash").toHex();
        await request(app)
            .post(`/api/loc-request/${ REQUEST_ID }/files`)
            .field({
                nature: "some nature",
                hash: wrongHash
            })
            .attach('file', buffer, {
                filename: FILE_NAME,
                contentType: 'text/plain',
            })
            .expect(400)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.errorMessage).toBe(`Received hash ${ wrongHash } does not match 0x1307990e6ba5ca145eb35e99182a9bec46531bc54ddf656a602c780fa0240dee`);
            });
    })

    it('fails to add file to loc if not contributor', async () => {
        const locRequest = new Mock<LocRequestAggregateRoot>();
        const mock = mockAuthenticationWithCondition(false, "5EnMt55QhBmQiTQBLu7kNhBbYpsyZwEHzQFxf5wfaFLzpbT6");
        const app = setupApp(LocRequestController, container => mockModelForAddFile(container, locRequest, 'NOT_ISSUER'), mock);
        await testAddFileForbidden(app);
    });

    it('fails to add file to loc if unselected verified issuer', async () => {
        const locRequest = new Mock<LocRequestAggregateRoot>();
        const authenticatedUserMock = mockAuthenticationForUserOrLegalOfficer(false, ISSUER.address);
        const app = setupApp(LocRequestController, container => mockModelForAddFile(container, locRequest, 'UNSELECTED'), authenticatedUserMock);
        await testAddFileForbidden(app);
    });

    it('downloads existing file given its hash', async () => {
        const app = setupApp(LocRequestController, container => mockModelForDownloadFile(container, 'NOT_ISSUER'));
        await testDownloadSuccess(app);
    });

    it('downloads existing file given its hash and is verified issuer', async () => {
        const authenticatedUserMock = mockAuthenticationForUserOrLegalOfficer(false, ISSUER.address);
        const app = setupApp(LocRequestController, container => mockModelForDownloadFile(container, 'SELECTED'), authenticatedUserMock);
        await testDownloadSuccess(app);
    });

    it('downloads existing file given its hash when LLO with Vote', async () => {
        const authenticatedUserMock = mockAuthenticationForUserOrLegalOfficer(true, BOB);
        const app = setupApp(LocRequestController, container => mockModelForDownloadFile(container, 'NOT_ISSUER', true), authenticatedUserMock);
        await testDownloadSuccess(app);
    });

    it('fails to download existing file given its hash when LLO without Vote', async () => {
        const authenticatedUserMock = mockAuthenticationForUserOrLegalOfficer(true, BOB);
        const app = setupApp(LocRequestController, container => mockModelForDownloadFile(container, 'NOT_ISSUER', false), authenticatedUserMock);
        await testDownloadForbidden(app);
    });

    it('fails to download existing file given its hash if not contributor', async () => {
        const authenticatedUserMock = mockAuthenticationForUserOrLegalOfficer(false, "some-address");
        const app = setupApp(LocRequestController, container => mockModelForDownloadFile(container, 'NOT_ISSUER'), authenticatedUserMock);
        await testDownloadForbidden(app);
    });

    it('fails to download existing file given its hash if unselected verified issuer', async () => {
        const authenticatedUserMock = mockAuthenticationForUserOrLegalOfficer(false, ISSUER.address);
        const app = setupApp(LocRequestController, container => mockModelForDownloadFile(container, 'UNSELECTED'), authenticatedUserMock);
        await testDownloadForbidden(app);
    });

    it('deletes a file', async () => {
        const locRequest = new Mock<LocRequestAggregateRoot>();
        const app = setupApp(LocRequestController, container => mockModelForDeleteFile(container, locRequest, 'NOT_ISSUER'))
        await testDeleteFileSuccess(app, locRequest, 'NOT_ISSUER');
    });

    it('deletes a file - verified issuer', async () => {
        const locRequest = new Mock<LocRequestAggregateRoot>();
        const authenticatedUserMock = mockAuthenticationForUserOrLegalOfficer(false, ISSUER.address);
        const app = setupApp(LocRequestController, container => mockModelForDeleteFile(container, locRequest, 'SELECTED'), authenticatedUserMock);
        await testDeleteFileSuccess(app, locRequest, 'SELECTED');
    });

    it('confirms a file', async () => {
        const app = setupApp(LocRequestController, mockModelForConfirmFile)
        await request(app)
            .put(`/api/loc-request/${REQUEST_ID}/files/${ SOME_DATA_HASH.toHex() }/confirm`)
            .expect(204);
    });

    it('adds a metadata item', async () => {
        const locRequest = mockRequestForMetadata();
        const app = setupApp(LocRequestController, (container) => mockModelForAnyItem(container, locRequest, 'NOT_ISSUER'))
        await testAddMetadataSuccess(app, locRequest, "MANUAL_BY_OWNER");
    });

    it('adds a metadata item - verified issuer', async () => {
        const authenticatedUserMock = mockAuthenticationForUserOrLegalOfficer(false, ISSUER.address);
        const locRequest = mockRequestForMetadata();
        mockOwner(locRequest, ALICE_ACCOUNT);
        mockRequester(locRequest, REQUESTER);
        const app = setupApp(LocRequestController, (container) => mockModelForAnyItem(container, locRequest, 'SELECTED'), authenticatedUserMock)
        await testAddMetadataSuccess(app, locRequest, "MANUAL_BY_USER");
    });

    it('fails to add a metadata item when not contributor', async () => {
        const locRequest = mockRequestForMetadata();
        const mock = mockAuthenticationForUserOrLegalOfficer(false, "any other address");
        const app = setupApp(LocRequestController, (container) => mockModelForAnyItem(container, locRequest, 'NOT_ISSUER'), mock);
        await testAddMetadataForbidden(app);
    });

    it('fails to add a metadata item when unselected verified issuer', async () => {
        const locRequest = mockRequestForMetadata();
        const mock = mockAuthenticationForUserOrLegalOfficer(false, "any other address");
        const app = setupApp(LocRequestController, (container) => mockModelForAnyItem(container, locRequest, 'UNSELECTED'), mock);
        await testAddMetadataForbidden(app);
    });

    it('deletes a metadata item', async () => {
        const locRequest = mockRequestForMetadata();
        const app = setupApp(LocRequestController, (container) => mockModelForAnyItem(container, locRequest, 'NOT_ISSUER'));
        await testDeleteMetadataSuccess(app, locRequest, false);
    });

    it('deletes a metadata item - verified issuer', async () => {
        const authenticatedUserMock = mockAuthenticationForUserOrLegalOfficer(false, ISSUER.address);
        const locRequest = mockRequestForMetadata();
        const app = setupApp(LocRequestController, (container) => mockModelForAnyItem(container, locRequest, 'SELECTED'), authenticatedUserMock);
        await testDeleteMetadataSuccess(app, locRequest, true);
    });

    it('confirms a metadata item', async () => {
        const app = setupApp(LocRequestController, (container) => mockModelForConfirmMetadata(container))
        await request(app)
            .put(`/api/loc-request/${ REQUEST_ID }/metadata/${ SOME_DATA_NAME_HASH.toHex() }/confirm`)
            .expect(204);
    });

    it('adds a link', async () => {
        const locRequest = mockRequestForLink();
        const app = setupApp(LocRequestController, (container) => mockModelForAddLink(container, locRequest))
        await request(app)
            .post(`/api/loc-request/${ REQUEST_ID }/links`)
            .send({ target: SOME_LINK_TARGET, nature: SOME_LINK_NATURE })
            .expect(204)
        locRequest.verify(instance => instance.addLink(
            It.Is<LinkDescription>(item => item.target == SOME_LINK_TARGET && item.nature == SOME_LINK_NATURE),
            It.IsAny<boolean>()
        ))
    });

    it('deletes a link', async () => {
        const locRequest = mockRequestForLink();
        const app = setupApp(LocRequestController, (container) => mockModelForAnyItem(container, locRequest, 'NOT_ISSUER'))
        await request(app)
            .delete(`/api/loc-request/${ REQUEST_ID }/links/${ SOME_LINK_TARGET }`)
            .expect(200)
        locRequest.verify(instance => instance.removeLink(
            It.Is<SupportedAccountId>(account => accountEquals(account, ALICE_ACCOUNT)),
            SOME_LINK_TARGET
        ))
    })

    it('confirms a link', async () => {
        const app = setupApp(LocRequestController, mockModelForConfirmLink);
        await request(app)
            .put(`/api/loc-request/${ REQUEST_ID }/links/${ SOME_LINK_TARGET }/confirm`)
            .expect(204)
    })
});

const SOME_DATA = 'some data';
const SOME_DATA_HASH = Hash.fromHex('0x1307990e6ba5ca145eb35e99182a9bec46531bc54ddf656a602c780fa0240dee');
const FILE_NAME = "'a-file.pdf'";

function mockModelForAddFile(container: Container, request: Mock<LocRequestAggregateRoot>, issuerMode: SetupIssuerMode): void {
    const { fileStorageService, loc } = buildMocksForUpdate(container, { request });

    setupRequest(request, REQUEST_ID, "Transaction", "OPEN", testData);
    request.setup(instance => instance.hasFile(ItIsHash(SOME_DATA_HASH))).returns(false);
    request.setup(instance => instance.addFile(It.IsAny(), It.IsAny<boolean>())).returns();

    setupSelectedIssuer(loc, issuerMode);

    fileStorageService.setup(instance => instance.importFile(It.IsAny<string>()))
        .returns(Promise.resolve("cid-42"));
}

const REQUESTER = polkadotAccount("5DDGQertEH5qvKVXUmpT3KNGViCX582Qa2WWb8nGbkmkRHvw");

async function testAddFileSuccess(app: Express, locRequest: Mock<LocRequestAggregateRoot>, submissionType: SubmissionType) {
    const buffer = Buffer.from(SOME_DATA);
    await request(app)
        .post(`/api/loc-request/${ REQUEST_ID }/files`)
        .field({
            nature: "some nature",
            hash: "0x1307990e6ba5ca145eb35e99182a9bec46531bc54ddf656a602c780fa0240dee",
            direct: "false",
        })
        .attach('file', buffer, {
            filename: FILE_NAME,
            contentType: 'text/plain',
        })
        .expect(200);
    locRequest.verify(instance => instance.addFile(It.IsAny(), It.Is<SubmissionType>(instance => instance === submissionType)));
}

async function testAddFileForbidden(app: Express) {
    const buffer = Buffer.from(SOME_DATA);
    await request(app)
        .post(`/api/loc-request/${ REQUEST_ID }/files`)
        .field({ nature: "some nature", hash: SOME_DATA_HASH.toHex() })
        .attach('file', buffer, {
            filename: FILE_NAME,
            contentType: 'text/plain',
        })
        .expect(403);
}

function mockModelForDownloadFile(container: Container, issuerMode: SetupIssuerMode, voteExists = false): void {
    const { request, fileStorageService, voteRepository, loc } = buildMocksForUpdate(container);

    setupRequest(request, REQUEST_ID, "Transaction", "OPEN", testData);
    mockOwner(request, ALICE_ACCOUNT);
    mockRequester(request, REQUESTER);

    const hash = SOME_DATA_HASH;
    request.setup(instance => instance.getFile(ItIsHash(hash))).returns({
        ...SOME_FILE,
        submitter: issuerMode !== "NOT_ISSUER" ? ISSUER : REQUESTER,
    });

    const filePath = "/tmp/download-" + REQUEST_ID + "-" + hash.toHex();
    fileStorageService.setup(instance => instance.exportFile({ oid: SOME_OID }, filePath))
        .returns(Promise.resolve());

    setupSelectedIssuer(loc, issuerMode);
    setUpVote(voteRepository, voteExists);
}

const SOME_OID = 123456;
const SOME_FILE: FileDescription = {
    name: "file-name",
    contentType: "text/plain",
    hash: SOME_DATA_HASH,
    oid: SOME_OID,
    nature: "file-nature",
    submitter: REQUESTER,
    restrictedDelivery: false,
    size: 123,
    status: "DRAFT",
};

async function testDownloadSuccess(app: Express) {
    const filePath = "/tmp/download-" + REQUEST_ID + "-" + SOME_DATA_HASH.toHex();
    await writeFile(filePath, SOME_DATA);
    await request(app)
        .get(`/api/loc-request/${ REQUEST_ID }/files/${ SOME_DATA_HASH.toHex() }`)
        .expect(200, SOME_DATA)
        .expect('Content-Type', /text\/plain/);
    await expectFileExists(filePath);
}

async function expectFileExists(filePath: string) {
    let fileReallyExists = true;
    for(let i = 0; i < 10; ++i) {
        if(!await fileExists(filePath)) {
            fileReallyExists = false;
            break;
        }
    }
    if(fileReallyExists) {
        expect(true).toBe(false);
    }
}

async function testDownloadForbidden(app: Express) {
    await request(app)
        .get(`/api/loc-request/${ REQUEST_ID }/files/${ SOME_DATA_HASH.toHex() }`)
        .expect(403);
}

function mockModelForDeleteFile(container: Container, request: Mock<LocRequestAggregateRoot>, issuerMode: SetupIssuerMode) {
    const { fileStorageService, loc } = buildMocksForUpdate(container, { request });

    setupRequest(request, REQUEST_ID, "Transaction", "OPEN", testData);
    mockOwner(request, ALICE_ACCOUNT);
    mockRequester(request, REQUESTER);

    if (issuerMode !== 'NOT_ISSUER') {
        request.setup(instance => instance.removeFile(
            It.Is<SupportedAccountId>(account => accountEquals(account, ISSUER)),
            SOME_DATA_HASH
        )).returns(SOME_FILE);
    } else {
        request.setup(instance => instance.removeFile(
            It.Is<SupportedAccountId>(account => accountEquals(account, ALICE_ACCOUNT)),
            SOME_DATA_HASH
        )).returns(SOME_FILE);
    }

    setupSelectedIssuer(loc, issuerMode);

    fileStorageService.setup(instance => instance.deleteFile({ oid: SOME_OID })).returns(Promise.resolve());
}

async function testDeleteFileSuccess(app: Express, locRequest: Mock<LocRequestAggregateRoot>, issuerMode: SetupIssuerMode) {
    await request(app)
        .delete(`/api/loc-request/${ REQUEST_ID }/files/${ SOME_DATA_HASH.toHex() }`)
        .expect(200);
    if(issuerMode !== 'NOT_ISSUER') {
        locRequest.verify(instance => instance.removeFile(
            It.Is<SupportedAccountId>(account => accountEquals(account, ISSUER)),
            ItIsHash(SOME_DATA_HASH)
        ));
    } else {
        locRequest.verify(instance => instance.removeFile(
            It.Is<SupportedAccountId>(account => accountEquals(account, ALICE_ACCOUNT)),
            ItIsHash(SOME_DATA_HASH)
        ));
    }
}

function mockModelForConfirmFile(container: Container) {
    const { request, repository } = buildMocksForUpdate(container);
    setupRequest(request, REQUEST_ID, "Transaction", "OPEN", testData);
    request.setup(instance => instance.getFile(ItIsHash(SOME_DATA_HASH))).returns({ submitter: { type: "Polkadot", address: ALICE } } as FileDescription);
    request.setup(instance => instance.canConfirmFile(ItIsHash(SOME_DATA_HASH), It.IsAny<SupportedAccountId>())).returns(true);
    request.setup(instance => instance.confirmFile(ItIsHash(SOME_DATA_HASH), ItIsAccount(ALICE))).returns();
    mockPolkadotIdentityLoc(repository, false);
}

const SOME_DATA_NAME = "data name with exotic char !é\"/&'"
const SOME_DATA_NAME_HASH = Hash.of("data name with exotic char !é\"/&'");
const SOME_DATA_VALUE = "data value with exotic char !é\"/&'"

function mockRequestForMetadata(): Mock<LocRequestAggregateRoot> {
    const request = mockRequest("OPEN", testData);
    mockOwner(request, ALICE_ACCOUNT);
    mockRequester(request, REQUESTER);
    request.setup(instance => instance.removeMetadataItem(ALICE_ACCOUNT, ItIsHash(SOME_DATA_NAME_HASH)))
        .returns()
    request.setup(instance => instance.confirmMetadataItem(ItIsHash(SOME_DATA_NAME_HASH), ItIsAccount(REQUESTER.address)))
        .returns()
    request.setup(instance => instance.addMetadataItem({
        name: SOME_DATA_NAME,
        value: SOME_DATA_VALUE,
        submitter: REQUESTER
    }, "MANUAL_BY_USER"))
        .returns()
    return request;
}

async function testAddMetadataSuccess(app: Express, locRequest: Mock<LocRequestAggregateRoot>, submissionType: SubmissionType) {
    await request(app)
        .post(`/api/loc-request/${ REQUEST_ID }/metadata`)
        .send({ name: SOME_DATA_NAME, value: SOME_DATA_VALUE })
        .expect(204)
    locRequest.verify(instance => instance.addMetadataItem(
        It.Is<MetadataItemDescription>(item => item.name == SOME_DATA_NAME && item.value == SOME_DATA_VALUE), submissionType));
}

async function testAddMetadataForbidden(app: Express) {
    await request(app)
        .post(`/api/loc-request/${ REQUEST_ID }/metadata`)
        .send({ name: SOME_DATA_NAME, value: SOME_DATA_VALUE })
        .expect(403);
}

async function testDeleteMetadataSuccess(app: Express, locRequest: Mock<LocRequestAggregateRoot>, isVerifiedIssuer: boolean) {
    await request(app)
        .delete(`/api/loc-request/${ REQUEST_ID }/metadata/${ SOME_DATA_NAME_HASH.toHex() }`)
        .expect(200);
    if(isVerifiedIssuer) {
        locRequest.verify(instance => instance.removeMetadataItem(It.Is<SupportedAccountId>(account => accountEquals(account, ISSUER)), ItIsHash(SOME_DATA_NAME_HASH)));
    } else {
        locRequest.verify(instance => instance.removeMetadataItem(It.Is<SupportedAccountId>(account => accountEquals(account, ALICE_ACCOUNT)), ItIsHash(SOME_DATA_NAME_HASH)));
    }
}

const SOME_LINK_TARGET = '35bac9a0-1516-4f8d-ae9e-9b14abe87e25'
const SOME_LINK_NATURE = 'link_nature'

function mockRequestForLink(): Mock<LocRequestAggregateRoot> {
    const request = mockRequest("OPEN", testData);
    request.setup(instance => instance.removeLink(ALICE_ACCOUNT, SOME_LINK_TARGET))
        .returns()
    request.setup(instance => instance.confirmLink(SOME_LINK_TARGET, ItIsAccount(REQUESTER.address)))
        .returns()
    request.setup(instance => instance.addLink(
        { target: SOME_LINK_TARGET, nature: SOME_LINK_NATURE, submitter: REQUESTER },
        It.IsAny<boolean>()
        ))
        .returns()
    return request;
}

function mockModelForAnyItem(container: Container, request: Mock<LocRequestAggregateRoot>, issuerMode: SetupIssuerMode) {
    const { repository, loc } = buildMocksForUpdate(container, { request });
    mockPolkadotIdentityLoc(repository, false);
    setupSelectedIssuer(loc, issuerMode);
}

function mockModelForAddLink(container: Container, request: Mock<LocRequestAggregateRoot>) {
    const { repository } = buildMocksForUpdate(container, { request });

    const linkTargetRequest = mockRequest("OPEN", testData);
    linkTargetRequest.setup(instance => instance.id).returns(SOME_LINK_TARGET)
    repository.setup(instance => instance.findById(SOME_LINK_TARGET))
        .returns(Promise.resolve(linkTargetRequest.object()));

    mockPolkadotIdentityLoc(repository, false);
}

function mockModelForConfirmMetadata(container: Container) {
    const { request, repository } = buildMocksForUpdate(container);
    setupRequest(request, REQUEST_ID, "Transaction", "OPEN", testData);
    request.setup(instance => instance.getMetadataItem(ItIsHash(SOME_DATA_NAME_HASH))).returns({ submitter: { type: "Polkadot", address: ALICE } } as MetadataItemDescription);
    request.setup(instance => instance.canConfirmMetadataItem(ItIsHash(SOME_DATA_NAME_HASH), It.IsAny<SupportedAccountId>())).returns(true);
    request.setup(instance => instance.confirmMetadataItem(ItIsHash(SOME_DATA_NAME_HASH), ItIsAccount(ALICE))).returns();
    mockPolkadotIdentityLoc(repository, false);
}

function mockModelForConfirmLink(container: Container) {
    const { request, repository } = buildMocksForUpdate(container);
    setupRequest(request, REQUEST_ID, "Transaction", "OPEN", testData);
    request.setup(instance => instance.getLink(SOME_LINK_TARGET)).returns({ submitter: { type: "Polkadot", address: ALICE } } as LinkDescription);
    request.setup(instance => instance.canConfirmLink(SOME_LINK_TARGET, It.IsAny<SupportedAccountId>())).returns(true);
    request.setup(instance => instance.confirmLink(SOME_LINK_TARGET, ItIsAccount(ALICE))).returns();
    mockPolkadotIdentityLoc(repository, false);
}
