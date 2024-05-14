import { TestApp } from "@logion/rest-api-core";
import { Express } from 'express';
import { LocRequestController } from "../../../src/logion/controllers/locrequest.controller.js";
import { Container } from "inversify";
import request from "supertest";
import { ALICE_ACCOUNT } from "../../helpers/addresses.js";
import { It, Mock } from "moq.ts";
import {
    LocRequestAggregateRoot,
} from "../../../src/logion/model/locrequest.model.js";
import {
    buildMocksForUpdate,
    mockPolkadotIdentityLoc,
    mockRequest,
    REQUEST_ID,
    testDataWithUserIdentity,
    mockRequester,
    mockOwner,
    POLKADOT_REQUESTER,
} from "./locrequest.controller.shared.js";
import { mockAuthenticationForUserOrLegalOfficer } from "@logion/rest-api-core/dist/TestApp.js";

const { setupApp } = TestApp;

describe('LocRequestController - Secrets -', () => {

    it('adds a secret', async () => {
        const locRequest = mockRequestForSecrets();
        const authenticatedUserMock = mockAuthenticationForUserOrLegalOfficer(false, POLKADOT_REQUESTER);
        const app = setupApp(LocRequestController, (container) => mockModel(container, locRequest), authenticatedUserMock);
        await testAddSecretSuccess(app, locRequest);
    });

    it('removes a secret', async () => {
        const locRequest = mockRequestForSecrets();
        const authenticatedUserMock = mockAuthenticationForUserOrLegalOfficer(false, POLKADOT_REQUESTER);
        const app = setupApp(LocRequestController, (container) => mockModel(container, locRequest), authenticatedUserMock);
        await testDeleteSecretSuccess(app, locRequest);
    });
});

function mockModel(container: Container, request: Mock<LocRequestAggregateRoot>) {
    const { repository } = buildMocksForUpdate(container, { request });
    mockPolkadotIdentityLoc(repository, false);
}

function mockRequestForSecrets(): Mock<LocRequestAggregateRoot> {
    const request = mockRequest("CLOSED", testDataWithUserIdentity, [], [], [], [], "Identity");
    mockOwner(request, ALICE_ACCOUNT);
    mockRequester(request, POLKADOT_REQUESTER);
    request.setup(instance => instance.isRequester(It.IsAny())).returns(true);
    request.setup(instance => instance.addSecret(SECRET_NAME, SECRET_VALUE))
        .returns();
    request.setup(instance => instance.removeSecret(SECRET_NAME))
        .returns();
    return request;
}

const SECRET_NAME = "name with exotic char !é\"/&'";
const SECRET_VALUE = "value with exotic char !é\"/&'";

async function testAddSecretSuccess(app: Express, locRequest: Mock<LocRequestAggregateRoot>) {
    await request(app)
        .post(`/api/loc-request/${ REQUEST_ID }/secrets`)
        .send({ name: SECRET_NAME, value: SECRET_VALUE })
        .expect(204);

    locRequest.verify(instance => instance.addSecret(SECRET_NAME, SECRET_VALUE));
}

async function testDeleteSecretSuccess(app: Express, locRequest: Mock<LocRequestAggregateRoot>) {
    await request(app)
        .delete(`/api/loc-request/${ REQUEST_ID }/secrets/${ encodeURIComponent(SECRET_NAME) }`)
        .expect(204);

    locRequest.verify(instance => instance.removeSecret(SECRET_NAME));
}
