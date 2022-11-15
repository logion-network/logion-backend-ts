import { TestApp } from "@logion/rest-api-core";
import { writeFile } from 'fs/promises';
import { LocRequestController } from "../../../src/logion/controllers/locrequest.controller";
import { Container } from "inversify";
import request from "supertest";
import { ALICE } from "../../helpers/addresses";
import { Mock, It } from "moq.ts";
import {
    LocRequestAggregateRoot,
    LinkDescription,
    MetadataItemDescription,
} from "../../../src/logion/model/locrequest.model";
import { fileExists } from "../../helpers/filehelper";
import { buildMocksForUpdate, mockPolkadotIdentityLoc, mockRequest, REQUEST_ID, setupRequest, testData } from "./locrequest.controller.shared";

const { mockAuthenticationWithCondition, setupApp } = TestApp;

describe('LocRequestController - Items', () => {

    it('adds file to loc', async () => {
        const app = setupApp(LocRequestController, mockModelForAddFile);
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
    })

    it('fails to add file to loc with wrong hash', async () => {
        const app = setupApp(LocRequestController, mockModelForAddFile);
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

    it('fails to add file to loc when neither owner nor requester', async () => {
        const mock = mockAuthenticationWithCondition(false);
        const app = setupApp(LocRequestController, mockModelForAddFile, mock);
        const buffer = Buffer.from(SOME_DATA);
        await request(app)
            .post(`/api/loc-request/${ REQUEST_ID }/files`)
            .field({ nature: "some nature" })
            .attach('file', buffer, {
                filename: FILE_NAME,
                contentType: 'text/plain',
            })
            .expect(401);
    })

    it('downloads existing file given its hash', async () => {
        const app = setupApp(LocRequestController, mockModelForDownloadFile);
        const filePath = "/tmp/download-" + REQUEST_ID + "-" + SOME_DATA_HASH;
        await writeFile(filePath, SOME_DATA);
        await request(app)
            .get(`/api/loc-request/${ REQUEST_ID }/files/${ SOME_DATA_HASH }`)
            .expect(200, SOME_DATA)
            .expect('Content-Type', /text\/plain/);
        await expectFileExists(filePath);
    })

    it('deletes a file', async () => {
        const app = setupApp(LocRequestController, mockModelForDeleteFile)
        await request(app)
            .delete(`/api/loc-request/${REQUEST_ID}/files/${SOME_DATA_HASH}`)
            .expect(200);
    });

    it('confirms a file', async () => {
        const app = setupApp(LocRequestController, mockModelForConfirmFile)
        await request(app)
            .put(`/api/loc-request/${REQUEST_ID}/files/${SOME_DATA_HASH}/confirm`)
            .expect(204);
    });

    it('adds a metadata item', async () => {
        const locRequest = mockRequestForMetadata();
        const app = setupApp(LocRequestController, (container) => mockModelForAllItems(container, locRequest))
        await request(app)
            .post(`/api/loc-request/${ REQUEST_ID }/metadata`)
            .send({ name: SOME_DATA_NAME, value: SOME_DATA_VALUE })
            .expect(204)
        locRequest.verify(instance => instance.addMetadataItem(
            It.Is<MetadataItemDescription>(item => item.name == SOME_DATA_NAME && item.value == SOME_DATA_VALUE)))
    })

    it('fails to adds a metadata item when neither owner nor requester', async () => {
        const locRequest = mockRequestForMetadata();
        const mock = mockAuthenticationWithCondition(false);
        const app = setupApp(LocRequestController, (container) => mockModelForAllItems(container, locRequest), mock);
        await request(app)
            .post(`/api/loc-request/${ REQUEST_ID }/metadata`)
            .send({ name: SOME_DATA_NAME, value: SOME_DATA_VALUE })
            .expect(401)
    })

    it('deletes a metadata item', async () => {
        const locRequest = mockRequestForMetadata();
        const app = setupApp(LocRequestController, (container) => mockModelForAllItems(container, locRequest))
        const dataName = encodeURIComponent(SOME_DATA_NAME)
        await request(app)
            .delete(`/api/loc-request/${ REQUEST_ID }/metadata/${ dataName }`)
            .expect(200)
        locRequest.verify(instance => instance.removeMetadataItem(ALICE, SOME_DATA_NAME))
    })

    it('confirms a metadata item', async () => {
        const locRequest = mockRequestForMetadata();
        const app = setupApp(LocRequestController, (container) => mockModelForAllItems(container, locRequest))
        const dataName = encodeURIComponent(SOME_DATA_NAME)
        await request(app)
            .put(`/api/loc-request/${ REQUEST_ID }/metadata/${ dataName }/confirm`)
            .expect(204)
        locRequest.verify(instance => instance.confirmMetadataItem(SOME_DATA_NAME))
    })

    it('adds a link', async () => {
        const locRequest = mockRequestForLink();
        const app = setupApp(LocRequestController, (container) => mockModelForAddLink(container, locRequest))
        await request(app)
            .post(`/api/loc-request/${ REQUEST_ID }/links`)
            .send({ target: SOME_LINK_TARGET, nature: SOME_LINK_NATURE })
            .expect(204)
        locRequest.verify(instance => instance.addLink(
            It.Is<LinkDescription>(item => item.target == SOME_LINK_TARGET && item.nature == SOME_LINK_NATURE)))
    })

    it('deletes a link', async () => {
        const locRequest = mockRequestForLink();
        const app = setupApp(LocRequestController, (container) => mockModelForAllItems(container, locRequest))
        await request(app)
            .delete(`/api/loc-request/${ REQUEST_ID }/links/${ SOME_LINK_TARGET }`)
            .expect(200)
        locRequest.verify(instance => instance.removeLink(ALICE, SOME_LINK_TARGET))
    })

    it('confirms a link', async () => {
        const locRequest = mockRequestForLink();
        const app = setupApp(LocRequestController, (container) => mockModelForAllItems(container, locRequest))
        await request(app)
            .put(`/api/loc-request/${ REQUEST_ID }/links/${ SOME_LINK_TARGET }/confirm`)
            .expect(204)
        locRequest.verify(instance => instance.confirmLink(SOME_LINK_TARGET))
    })
});

const SOME_DATA = 'some data';
const SOME_DATA_HASH = '0x1307990e6ba5ca145eb35e99182a9bec46531bc54ddf656a602c780fa0240dee';
const FILE_NAME = "'a-file.pdf'";

function mockModelForAddFile(container: Container): void {
    const { request, fileStorageService } = buildMocksForUpdate(container);

    setupRequest(request, REQUEST_ID, "Transaction", "OPEN", testData);
    request.setup(instance => instance.hasFile(SOME_DATA_HASH)).returns(false);
    request.setup(instance => instance.addFile).returns(() => {});

    fileStorageService.setup(instance => instance.importFile(It.IsAny<string>()))
        .returns(Promise.resolve("cid-42"));
}

function mockModelForDownloadFile(container: Container): void {
    const { request, fileStorageService } = buildMocksForUpdate(container);

    setupRequest(request, REQUEST_ID, "Transaction", "OPEN", testData);
    const hash = SOME_DATA_HASH;
    request.setup(instance => instance.getFile(hash)).returns(SOME_FILE);

    const filePath = "/tmp/download-" + REQUEST_ID + "-" + hash;
    fileStorageService.setup(instance => instance.exportFile({ oid: SOME_OID }, filePath))
        .returns(Promise.resolve());
}

const SOME_OID = 123456;
const SUBMITTER = "5DDGQertEH5qvKVXUmpT3KNGViCX582Qa2WWb8nGbkmkRHvw";
const SOME_FILE = {
    name: "file-name",
    contentType: "text/plain",
    hash: SOME_DATA_HASH,
    oid: SOME_OID,
    nature: "file-nature",
    submitter: SUBMITTER
};

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

function mockModelForDeleteFile(container: Container) {
    const { request, fileStorageService } = buildMocksForUpdate(container);
    setupRequest(request, REQUEST_ID, "Transaction", "OPEN", testData);
    request.setup(instance => instance.removeFile(ALICE, SOME_DATA_HASH)).returns(SOME_FILE);

    fileStorageService.setup(instance => instance.deleteFile({ oid: SOME_OID })).returns(Promise.resolve());
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
    request.setup(instance => instance.removeMetadataItem(ALICE, SOME_DATA_NAME))
        .returns()
    request.setup(instance => instance.confirmMetadataItem(SOME_DATA_NAME))
        .returns()
    request.setup(instance => instance.addMetadataItem({
        name: SOME_DATA_NAME,
        value: SOME_DATA_VALUE,
        submitter: SUBMITTER
    }))
        .returns()
    return request;
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

function mockModelForAllItems(container: Container, request: Mock<LocRequestAggregateRoot>) {
    const { repository } = buildMocksForUpdate(container, { request });
    mockPolkadotIdentityLoc(repository, false);
}

function mockModelForAddLink(container: Container, request: Mock<LocRequestAggregateRoot>) {
    const { repository } = buildMocksForUpdate(container, { request });

    const linkTargetRequest = mockRequest("OPEN", testData);
    linkTargetRequest.setup(instance => instance.id).returns(SOME_LINK_TARGET)
    repository.setup(instance => instance.findById(SOME_LINK_TARGET))
        .returns(Promise.resolve(linkTargetRequest.object()));

    mockPolkadotIdentityLoc(repository, false);
}
