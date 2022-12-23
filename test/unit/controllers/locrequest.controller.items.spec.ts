import { TestApp } from "@logion/rest-api-core";
import { Express } from 'express';
import { writeFile } from 'fs/promises';
import { LocRequestController } from "../../../src/logion/controllers/locrequest.controller.js";
import { Container } from "inversify";
import request from "supertest";
import { ALICE, BOB } from "../../helpers/addresses.js";
import { Mock, It } from "moq.ts";
import {
    LocRequestAggregateRoot,
    LinkDescription,
    MetadataItemDescription,
} from "../../../src/logion/model/locrequest.model.js";
import { fileExists } from "../../helpers/filehelper.js";
import {
    buildMocksForUpdate,
    mockPolkadotIdentityLoc,
    mockRequest,
    REQUEST_ID,
    setupRequest,
    setupSelectedVtp,
    SetupVtpMode,
    testData,
    VTP_ADDRESS,
    setUpVote
} from "./locrequest.controller.shared.js";
import { mockAuthenticationForUserOrLegalOfficer } from "@logion/rest-api-core/dist/TestApp.js";

const { mockAuthenticationWithCondition, setupApp } = TestApp;

describe('LocRequestController - Items -', () => {

    it('adds file to loc', async () => {
        const locRequest = new Mock<LocRequestAggregateRoot>();
        locRequest.setup(instance => instance.ownerAddress).returns(ALICE);
        locRequest.setup(instance => instance.requesterAddress).returns(REQUESTER);
        const app = setupApp(LocRequestController, container => mockModelForAddFile(container, locRequest, 'NOT_VTP'));
        await testAddFileSuccess(app, locRequest);
    })

    it('adds file to loc - VTP', async () => {
        const authenticatedUserMock = mockAuthenticationForUserOrLegalOfficer(false, VTP_ADDRESS);
        const locRequest = new Mock<LocRequestAggregateRoot>();
        const app = setupApp(LocRequestController, container => mockModelForAddFile(container, locRequest, 'SELECTED'), authenticatedUserMock);
        await testAddFileSuccess(app, locRequest);
    })

    it('fails to add file to loc with wrong hash', async () => {
        const locRequest = new Mock<LocRequestAggregateRoot>();
        locRequest.setup(instance => instance.ownerAddress).returns(ALICE);
        locRequest.setup(instance => instance.requesterAddress).returns(REQUESTER);
        const app = setupApp(LocRequestController, container => mockModelForAddFile(container, locRequest, 'NOT_VTP'));
        const buffer = Buffer.from(SOME_DATA);
        await request(app)
            .post(`/api/loc-request/${ REQUEST_ID }/files`)
            .field({
                nature: "some nature",
                hash: "wrong-hash"
            })
            .attach('file', buffer, {
                filename: FILE_NAME,
                contentType: 'text/plain',
            })
            .expect(400)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.errorMessage).toBe("Received hash wrong-hash does not match 0x1307990e6ba5ca145eb35e99182a9bec46531bc54ddf656a602c780fa0240dee");
            });
    })

    it('fails to add file to loc if not contributor', async () => {
        const locRequest = new Mock<LocRequestAggregateRoot>();
        const mock = mockAuthenticationWithCondition(false, "5EnMt55QhBmQiTQBLu7kNhBbYpsyZwEHzQFxf5wfaFLzpbT6");
        const app = setupApp(LocRequestController, container => mockModelForAddFile(container, locRequest, 'NOT_VTP'), mock);
        await testAddFileForbidden(app);
    });

    it('fails to add file to loc if unselected VTP', async () => {
        const locRequest = new Mock<LocRequestAggregateRoot>();
        const authenticatedUserMock = mockAuthenticationForUserOrLegalOfficer(false, VTP_ADDRESS);
        const app = setupApp(LocRequestController, container => mockModelForAddFile(container, locRequest, 'UNSELECTED'), authenticatedUserMock);
        await testAddFileForbidden(app);
    });

    it('downloads existing file given its hash', async () => {
        const app = setupApp(LocRequestController, container => mockModelForDownloadFile(container, 'NOT_VTP'));
        await testDownloadSuccess(app);
    });

    it('downloads existing file given its hash and is VTP', async () => {
        const authenticatedUserMock = mockAuthenticationForUserOrLegalOfficer(false, VTP_ADDRESS);
        const app = setupApp(LocRequestController, container => mockModelForDownloadFile(container, 'SELECTED'), authenticatedUserMock);
        await testDownloadSuccess(app);
    });

    it('downloads existing file given its hash when LLO with Vote', async () => {
        const authenticatedUserMock = mockAuthenticationForUserOrLegalOfficer(true, BOB);
        const app = setupApp(LocRequestController, container => mockModelForDownloadFile(container, 'NOT_VTP', true), authenticatedUserMock);
        await testDownloadSuccess(app);
    });

    it('fails to download existing file given its hash when LLO without Vote', async () => {
        const authenticatedUserMock = mockAuthenticationForUserOrLegalOfficer(true, BOB);
        const app = setupApp(LocRequestController, container => mockModelForDownloadFile(container, 'NOT_VTP', false), authenticatedUserMock);
        await testDownloadForbidden(app);
    });

    it('fails to download existing file given its hash if not contributor', async () => {
        const authenticatedUserMock = mockAuthenticationForUserOrLegalOfficer(false, "some-address");
        const app = setupApp(LocRequestController, container => mockModelForDownloadFile(container, 'NOT_VTP'), authenticatedUserMock);
        await testDownloadForbidden(app);
    });

    it('fails to download existing file given its hash if unselected VTP', async () => {
        const authenticatedUserMock = mockAuthenticationForUserOrLegalOfficer(false, VTP_ADDRESS);
        const app = setupApp(LocRequestController, container => mockModelForDownloadFile(container, 'UNSELECTED'), authenticatedUserMock);
        await testDownloadForbidden(app);
    });

    it('deletes a file', async () => {
        const locRequest = new Mock<LocRequestAggregateRoot>();
        const app = setupApp(LocRequestController, container => mockModelForDeleteFile(container, locRequest, 'NOT_VTP'))
        await testDeleteFileSuccess(app, locRequest, 'NOT_VTP');
    });

    it('deletes a file - VTP', async () => {
        const locRequest = new Mock<LocRequestAggregateRoot>();
        const authenticatedUserMock = mockAuthenticationForUserOrLegalOfficer(false, VTP_ADDRESS);
        const app = setupApp(LocRequestController, container => mockModelForDeleteFile(container, locRequest, 'SELECTED'), authenticatedUserMock);
        await testDeleteFileSuccess(app, locRequest, 'SELECTED');
    });

    it('confirms a file', async () => {
        const app = setupApp(LocRequestController, mockModelForConfirmFile)
        await request(app)
            .put(`/api/loc-request/${REQUEST_ID}/files/${SOME_DATA_HASH}/confirm`)
            .expect(204);
    });

    it('adds a metadata item', async () => {
        const locRequest = mockRequestForMetadata();
        const app = setupApp(LocRequestController, (container) => mockModelForAnyItem(container, locRequest, 'NOT_VTP'))
        await testAddMetadataSuccess(app, locRequest);
    });

    it('adds a metadata item - VTP', async () => {
        const authenticatedUserMock = mockAuthenticationForUserOrLegalOfficer(false, VTP_ADDRESS);
        const locRequest = mockRequestForMetadata();
        locRequest.setup(instance => instance.ownerAddress).returns(ALICE);
        locRequest.setup(instance => instance.requesterAddress).returns(REQUESTER);
        const app = setupApp(LocRequestController, (container) => mockModelForAnyItem(container, locRequest, 'SELECTED'), authenticatedUserMock)
        await testAddMetadataSuccess(app, locRequest);
    });

    it('fails to add a metadata item when not contributor', async () => {
        const locRequest = mockRequestForMetadata();
        const mock = mockAuthenticationForUserOrLegalOfficer(false, "any other address");
        const app = setupApp(LocRequestController, (container) => mockModelForAnyItem(container, locRequest, 'NOT_VTP'), mock);
        await testAddMetadataForbidden(app);
    });

    it('fails to add a metadata item when unselected VTP', async () => {
        const locRequest = mockRequestForMetadata();
        const mock = mockAuthenticationForUserOrLegalOfficer(false, "any other address");
        const app = setupApp(LocRequestController, (container) => mockModelForAnyItem(container, locRequest, 'UNSELECTED'), mock);
        await testAddMetadataForbidden(app);
    });

    it('deletes a metadata item', async () => {
        const locRequest = mockRequestForMetadata();
        const app = setupApp(LocRequestController, (container) => mockModelForAnyItem(container, locRequest, 'NOT_VTP'));
        await testDeleteMetadataSuccess(app, locRequest, false);
    });

    it('deletes a metadata item - VTP', async () => {
        const authenticatedUserMock = mockAuthenticationForUserOrLegalOfficer(false, VTP_ADDRESS);
        const locRequest = mockRequestForMetadata();
        const app = setupApp(LocRequestController, (container) => mockModelForAnyItem(container, locRequest, 'SELECTED'), authenticatedUserMock);
        await testDeleteMetadataSuccess(app, locRequest, true);
    });

    it('confirms a metadata item', async () => {
        const locRequest = mockRequestForMetadata();
        const app = setupApp(LocRequestController, (container) => mockModelForAnyItem(container, locRequest, 'NOT_VTP'))
        const dataName = encodeURIComponent(SOME_DATA_NAME)
        await request(app)
            .put(`/api/loc-request/${ REQUEST_ID }/metadata/${ dataName }/confirm`)
            .expect(204)
        locRequest.verify(instance => instance.confirmMetadataItem(SOME_DATA_NAME))
    });

    it('adds a link', async () => {
        const locRequest = mockRequestForLink();
        const app = setupApp(LocRequestController, (container) => mockModelForAddLink(container, locRequest))
        await request(app)
            .post(`/api/loc-request/${ REQUEST_ID }/links`)
            .send({ target: SOME_LINK_TARGET, nature: SOME_LINK_NATURE })
            .expect(204)
        locRequest.verify(instance => instance.addLink(
            It.Is<LinkDescription>(item => item.target == SOME_LINK_TARGET && item.nature == SOME_LINK_NATURE)))
    });

    it('deletes a link', async () => {
        const locRequest = mockRequestForLink();
        const app = setupApp(LocRequestController, (container) => mockModelForAnyItem(container, locRequest, 'NOT_VTP'))
        await request(app)
            .delete(`/api/loc-request/${ REQUEST_ID }/links/${ SOME_LINK_TARGET }`)
            .expect(200)
        locRequest.verify(instance => instance.removeLink(ALICE, SOME_LINK_TARGET))
    })

    it('confirms a link', async () => {
        const locRequest = mockRequestForLink();
        const app = setupApp(LocRequestController, (container) => mockModelForAnyItem(container, locRequest, 'NOT_VTP'))
        await request(app)
            .put(`/api/loc-request/${ REQUEST_ID }/links/${ SOME_LINK_TARGET }/confirm`)
            .expect(204)
        locRequest.verify(instance => instance.confirmLink(SOME_LINK_TARGET))
    })
});

const SOME_DATA = 'some data';
const SOME_DATA_HASH = '0x1307990e6ba5ca145eb35e99182a9bec46531bc54ddf656a602c780fa0240dee';
const FILE_NAME = "'a-file.pdf'";

function mockModelForAddFile(container: Container, request: Mock<LocRequestAggregateRoot>, vtpMode: SetupVtpMode): void {
    const { fileStorageService, repository, verifiedThirdPartySelectionRepository } = buildMocksForUpdate(container, { request });

    setupRequest(request, REQUEST_ID, "Transaction", "OPEN", testData);
    request.setup(instance => instance.hasFile(SOME_DATA_HASH)).returns(false);
    request.setup(instance => instance.addFile(It.IsAny())).returns();

    setupSelectedVtp({ repository, verifiedThirdPartySelectionRepository }, vtpMode);

    fileStorageService.setup(instance => instance.importFile(It.IsAny<string>()))
        .returns(Promise.resolve("cid-42"));
}

const REQUESTER = "5DDGQertEH5qvKVXUmpT3KNGViCX582Qa2WWb8nGbkmkRHvw";

async function testAddFileSuccess(app: Express, locRequest: Mock<LocRequestAggregateRoot>) {
    const buffer = Buffer.from(SOME_DATA);
    await request(app)
        .post(`/api/loc-request/${ REQUEST_ID }/files`)
        .field({
            nature: "some nature",
            hash: "0x1307990e6ba5ca145eb35e99182a9bec46531bc54ddf656a602c780fa0240dee"
        })
        .attach('file', buffer, {
            filename: FILE_NAME,
            contentType: 'text/plain',
        })
        .expect(200);
    locRequest.verify(instance => instance.addFile(It.IsAny()));
}

async function testAddFileForbidden(app: Express) {
    const buffer = Buffer.from(SOME_DATA);
    await request(app)
        .post(`/api/loc-request/${ REQUEST_ID }/files`)
        .field({ nature: "some nature" })
        .attach('file', buffer, {
            filename: FILE_NAME,
            contentType: 'text/plain',
        })
        .expect(403);
}

function mockModelForDownloadFile(container: Container, vtpMode: SetupVtpMode, voteExists = false): void {
    const { request, fileStorageService, repository, verifiedThirdPartySelectionRepository, voteRepository } = buildMocksForUpdate(container);

    setupRequest(request, REQUEST_ID, "Transaction", "OPEN", testData);
    request.setup(instance => instance.ownerAddress).returns(ALICE);
    request.setup(instance => instance.requesterAddress).returns(REQUESTER);

    const hash = SOME_DATA_HASH;
    request.setup(instance => instance.getFile(hash)).returns({
        ...SOME_FILE,
        submitter: vtpMode !== "NOT_VTP" ? VTP_ADDRESS : REQUESTER,
    });

    const filePath = "/tmp/download-" + REQUEST_ID + "-" + hash;
    fileStorageService.setup(instance => instance.exportFile({ oid: SOME_OID }, filePath))
        .returns(Promise.resolve());

    setupSelectedVtp({ repository, verifiedThirdPartySelectionRepository }, vtpMode);
    setUpVote(voteRepository, voteExists);
}

const SOME_OID = 123456;
const SOME_FILE = {
    name: "file-name",
    contentType: "text/plain",
    hash: SOME_DATA_HASH,
    oid: SOME_OID,
    nature: "file-nature",
    submitter: REQUESTER
};

async function testDownloadSuccess(app: Express) {
    const filePath = "/tmp/download-" + REQUEST_ID + "-" + SOME_DATA_HASH;
    await writeFile(filePath, SOME_DATA);
    await request(app)
        .get(`/api/loc-request/${ REQUEST_ID }/files/${ SOME_DATA_HASH }`)
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
        .get(`/api/loc-request/${ REQUEST_ID }/files/${ SOME_DATA_HASH }`)
        .expect(403);
}

function mockModelForDeleteFile(container: Container, request: Mock<LocRequestAggregateRoot>, vtpMode: SetupVtpMode) {
    const { fileStorageService, repository, verifiedThirdPartySelectionRepository } = buildMocksForUpdate(container, { request });

    setupRequest(request, REQUEST_ID, "Transaction", "OPEN", testData);
    request.setup(instance => instance.ownerAddress).returns(ALICE);
    request.setup(instance => instance.requesterAddress).returns(REQUESTER);

    if(vtpMode !== 'NOT_VTP') {
        request.setup(instance => instance.removeFile(VTP_ADDRESS, SOME_DATA_HASH)).returns(SOME_FILE);
    } else {
        request.setup(instance => instance.removeFile(ALICE, SOME_DATA_HASH)).returns(SOME_FILE);
    }

    setupSelectedVtp({ repository, verifiedThirdPartySelectionRepository }, vtpMode);

    fileStorageService.setup(instance => instance.deleteFile({ oid: SOME_OID })).returns(Promise.resolve());
}

async function testDeleteFileSuccess(app: Express, locRequest: Mock<LocRequestAggregateRoot>, vtpMode: SetupVtpMode) {
    await request(app)
        .delete(`/api/loc-request/${REQUEST_ID}/files/${SOME_DATA_HASH}`)
        .expect(200);
    if(vtpMode !== 'NOT_VTP') {
        locRequest.verify(instance => instance.removeFile(VTP_ADDRESS, SOME_DATA_HASH));
    } else {
        locRequest.verify(instance => instance.removeFile(ALICE, SOME_DATA_HASH));
    }
}

function mockModelForConfirmFile(container: Container) {
    const { request, repository } = buildMocksForUpdate(container);
    setupRequest(request, REQUEST_ID, "Transaction", "OPEN", testData);
    request.setup(instance => instance.confirmFile(SOME_DATA_HASH)).returns();
    mockPolkadotIdentityLoc(repository, false);
}

const SOME_DATA_NAME = "data name with exotic char !é\"/&'"
const SOME_DATA_VALUE = "data value with exotic char !é\"/&'"

function mockRequestForMetadata(): Mock<LocRequestAggregateRoot> {
    const request = mockRequest("OPEN", testData);
    request.setup(instance => instance.ownerAddress).returns(ALICE);
    request.setup(instance => instance.requesterAddress).returns(REQUESTER);
    request.setup(instance => instance.removeMetadataItem(ALICE, SOME_DATA_NAME))
        .returns()
    request.setup(instance => instance.confirmMetadataItem(SOME_DATA_NAME))
        .returns()
    request.setup(instance => instance.addMetadataItem({
        name: SOME_DATA_NAME,
        value: SOME_DATA_VALUE,
        submitter: REQUESTER
    }))
        .returns()
    return request;
}

async function testAddMetadataSuccess(app: Express, locRequest: Mock<LocRequestAggregateRoot>) {
    await request(app)
        .post(`/api/loc-request/${ REQUEST_ID }/metadata`)
        .send({ name: SOME_DATA_NAME, value: SOME_DATA_VALUE })
        .expect(204)
    locRequest.verify(instance => instance.addMetadataItem(
        It.Is<MetadataItemDescription>(item => item.name == SOME_DATA_NAME && item.value == SOME_DATA_VALUE)));
}

async function testAddMetadataForbidden(app: Express) {
    await request(app)
        .post(`/api/loc-request/${ REQUEST_ID }/metadata`)
        .send({ name: SOME_DATA_NAME, value: SOME_DATA_VALUE })
        .expect(403);
}

async function testDeleteMetadataSuccess(app: Express, locRequest: Mock<LocRequestAggregateRoot>, isVtp: boolean) {
    const dataName = encodeURIComponent(SOME_DATA_NAME)
    await request(app)
        .delete(`/api/loc-request/${ REQUEST_ID }/metadata/${ dataName }`)
        .expect(200);
    if(isVtp) {
        locRequest.verify(instance => instance.removeMetadataItem(VTP_ADDRESS, SOME_DATA_NAME));
    } else {
        locRequest.verify(instance => instance.removeMetadataItem(ALICE, SOME_DATA_NAME));
    }
}

const SOME_LINK_TARGET = '35bac9a0-1516-4f8d-ae9e-9b14abe87e25'
const SOME_LINK_NATURE = 'link_nature'

function mockRequestForLink(): Mock<LocRequestAggregateRoot> {
    const request = mockRequest("OPEN", testData);
    request.setup(instance => instance.removeLink(ALICE, SOME_LINK_TARGET))
        .returns()
    request.setup(instance => instance.confirmLink(SOME_LINK_TARGET))
        .returns()
    request.setup(instance => instance.addLink({ target: SOME_LINK_TARGET, nature: SOME_LINK_NATURE}))
        .returns()
    return request;
}

function mockModelForAnyItem(container: Container, request: Mock<LocRequestAggregateRoot>, vtpMode: SetupVtpMode) {
    const { repository, verifiedThirdPartySelectionRepository } = buildMocksForUpdate(container, { request });
    mockPolkadotIdentityLoc(repository, false);
    setupSelectedVtp({ repository, verifiedThirdPartySelectionRepository }, vtpMode);
}

function mockModelForAddLink(container: Container, request: Mock<LocRequestAggregateRoot>) {
    const { repository } = buildMocksForUpdate(container, { request });

    const linkTargetRequest = mockRequest("OPEN", testData);
    linkTargetRequest.setup(instance => instance.id).returns(SOME_LINK_TARGET)
    repository.setup(instance => instance.findById(SOME_LINK_TARGET))
        .returns(Promise.resolve(linkTargetRequest.object()));

    mockPolkadotIdentityLoc(repository, false);
}
