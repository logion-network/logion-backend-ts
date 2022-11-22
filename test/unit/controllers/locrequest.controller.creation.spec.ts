import { TestApp } from "@logion/rest-api-core";
import { LocRequestController } from "../../../src/logion/controllers/locrequest.controller";
import { Container } from "inversify";
import request from "supertest";
import { ALICE } from "../../helpers/addresses";
import { Mock, It, Times } from "moq.ts";
import {
    NewLocRequestParameters,
    LocType,
    NewUserLocRequestParameters,
} from "../../../src/logion/model/locrequest.model";
import { NotificationService } from "../../../src/logion/services/notification.service";
import { testDataWithType, userIdentities, testDataWithLogionIdentity, testDataWithUserIdentityWithType, SEAL, buildMocks, mockRequest, mockPolkadotIdentityLoc, mockLogionIdentityLoc, testData, checkPrivateData } from "./locrequest.controller.shared";

const { mockAuthenticationForUserOrLegalOfficer, mockAuthenticationWithCondition, setupApp } = TestApp;

describe('LocRequestController - Creation -', () => {

    it('user fails to create a Transaction loc request with embedded user identity', async () => {
        await testLocRequestCreationWithEmbeddedUserIdentity(false, "Transaction", 400, "Unable to find a valid (closed) identity LOC.")
    });

    it('user fails to create a Collection loc request with embedded user identity', async () => {
        await testLocRequestCreationWithEmbeddedUserIdentity(false, "Collection", 400, "Unable to find a valid (closed) identity LOC.")
    });

    it('user succeeds to create a Polkadot Identity loc request', async () => {
        await testLocRequestCreationWithEmbeddedUserIdentity(false, "Identity", 200)
    });

    it('user fails to create twice the same Polkadot Identity loc request', async () => {
        await testLocRequestCreationWithEmbeddedUserIdentity(false, "Identity", 400, "Only one Polkadot Identity LOC is allowed per Legal Officer.", true)
    });

    it('LLO fails to create Transaction loc with embedded user identity', async () => {
        await testLocRequestCreationWithEmbeddedUserIdentity(true, "Transaction", 400, "Unable to find a valid (closed) identity LOC.")
    });

    it('LLO fails to create Collection loc with embedded user identity', async () => {
        await testLocRequestCreationWithEmbeddedUserIdentity(true, "Collection", 400, "Unable to find a valid (closed) identity LOC.")
    });

    it('LLO succeeds to create Identity loc with embedded user identity', async () => {
        await testLocRequestCreationWithEmbeddedUserIdentity(true, "Identity", 200)
    });

    it('LLO fails to create twice the same Identity loc with embedded user identity', async () => {
        await testLocRequestCreationWithEmbeddedUserIdentity(true, "Identity", 400, "Only one Polkadot Identity LOC is allowed per Legal Officer.", true)
    });

    it('LLO succeeds to create Transaction loc with existing existing identity LOC', async () => {
        await testLocRequestCreationWithIdentityLoc(true, "Transaction")
    });

    it('LLO succeeds to create Collection loc with existing existing identity LOC', async () => {
        await testLocRequestCreationWithIdentityLoc(true, "Collection")
    });

    it('user succeeds to create Transaction loc request with existing identity LOC', async () => {
        await testLocRequestCreationWithIdentityLoc(false, "Transaction")
    });

    it('user succeeds to create Collection loc request with existing identity LOC', async () => {
        await testLocRequestCreationWithIdentityLoc(false, "Collection")
    });

    it('succeeds in creating a draft LOC', async () => {
        const mock = mockAuthenticationForUserOrLegalOfficer(false);
        const app = setupApp(
            LocRequestController,
            container => mockModelForCreation(container, "Transaction", undefined, true),
            mock,
        )
        await request(app)
            .post('/api/loc-request')
            .send(testDataWithType("Transaction", true))
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.status).toBe("DRAFT");
            });
    });

    it('succeeds to create requested loc with a Logion identity LOC', async () => {
        const mock = mockAuthenticationForUserOrLegalOfficer(true);
        const app = setupApp(
            LocRequestController,
            mockModelForCreationWithLogionIdentityLoc,
            mock,
        )
        const expectedUserPrivateData = userIdentities["Logion"];
        await request(app)
            .post('/api/loc-request')
            .send(testDataWithLogionIdentity)
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.id).toBeDefined();
                expect(response.body.status).toBe("REQUESTED");
                expect(response.body.locType).toBe("Transaction");
                expect(response.body.requesterAddress).toBeUndefined();
                expect(response.body.requesterIdentityLoc).toBe(expectedUserPrivateData.identityLocId);
                checkPrivateData(response, expectedUserPrivateData);
            });
    });

    it('fails to create loc request - authentication failure', async () => {
        const app = setupApp(
            LocRequestController,
            container => mockModelForCreation(container, "Transaction"),
            mockAuthenticationWithCondition(false),
        );
        await request(app)
            .post('/api/loc-request')
            .send(testDataWithType("Transaction"))
            .expect(401)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.id).toBeUndefined();
            });
    });
});

async function testLocRequestCreationWithEmbeddedUserIdentity(isLegalOfficer: boolean, locType: LocType, expectedStatus: number, expectedErrorMessage?: string, hasPolkadotIdentityLoc: boolean = false) {
    const mock = mockAuthenticationForUserOrLegalOfficer(isLegalOfficer);
    const app = setupApp(
        LocRequestController,
        container => mockModelForCreation(container, locType, undefined, hasPolkadotIdentityLoc),
        mock
    )
    const expectedUserPrivateData = userIdentities["EmbeddedInLoc"];
    await request(app)
        .post('/api/loc-request')
        .send(testDataWithUserIdentityWithType(locType))
        .expect(expectedStatus)
        .expect('Content-Type', /application\/json/)
        .then(response => {
            if (expectedStatus === 200) {
                expect(response.body.id).toBeDefined();
                expect(response.body.status).toBe("REQUESTED");
                expect(response.body.locType).toBe(locType);
                checkPrivateData(response, expectedUserPrivateData);
                expect(response.body.seal).toEqual(SEAL.hash)
            } else {
                expect(response.body.errorMessage).toEqual(expectedErrorMessage);
            }
        });
}

async function testLocRequestCreationWithIdentityLoc(isLegalOfficer: boolean, locType: LocType) {
    const mock = mockAuthenticationForUserOrLegalOfficer(isLegalOfficer);
    const notificationService = new Mock<NotificationService>();
    const app = setupApp(
        LocRequestController,
        container => mockModelForCreation(container, locType, notificationService, true),
        mock,
    )
    const expectedUserPrivateData = userIdentities["Polkadot"];
    await request(app)
        .post('/api/loc-request')
        .send(testDataWithType(locType))
        .expect(200)
        .expect('Content-Type', /application\/json/)
        .then(response => {
            expect(response.body.id).toBeDefined();
            expect(response.body.status).toBe("REQUESTED");
            expect(response.body.locType).toBe(locType);
            checkPrivateData(response, expectedUserPrivateData);
        });

    if(isLegalOfficer) {
        notificationService.verify(instance => instance.notify, Times.Never());
    } else {
        notificationService.verify(instance => instance.notify("alice@logion.network", "loc-requested", It.Is<any>(data => {
            return data.loc.locType === locType
        })));
    }
}

function mockModelForCreation(container: Container, locType: LocType, notificationService: Mock<NotificationService> | undefined = undefined, hasPolkadotIdentityLoc: boolean = false): void {
    const { factory, repository } = buildMocks(container, { notificationService });

    const draft = mockRequest("DRAFT", hasPolkadotIdentityLoc ? testDataWithType(locType) : testDataWithUserIdentityWithType(locType));
    factory.setup(instance => instance.newLocRequest(It.Is<NewUserLocRequestParameters>(params =>
        params.description.requesterAddress == testData.requesterAddress &&
        params.description.ownerAddress == ALICE &&
        params.description.description == testData.description &&
        params.draft
    )))
        .returns(Promise.resolve(draft.object()));
    repository.setup(instance => instance.save(draft.object()))
        .returns(Promise.resolve());

    const requested = mockRequest("REQUESTED", hasPolkadotIdentityLoc ? testDataWithType(locType) : testDataWithUserIdentityWithType(locType));
    factory.setup(instance => instance.newLocRequest(It.Is<NewUserLocRequestParameters>(params =>
        params.description.requesterAddress == testData.requesterAddress &&
        params.description.ownerAddress == ALICE &&
        params.description.description == testData.description &&
        !params.draft
    )))
        .returns(Promise.resolve(requested.object()));
    repository.setup(instance => instance.save(requested.object()))
        .returns(Promise.resolve());

    const requestByLO = mockRequest("REQUESTED", hasPolkadotIdentityLoc ? testDataWithType(locType) : testDataWithUserIdentityWithType(locType));
    factory.setup(instance => instance.newLOLocRequest(It.Is<NewLocRequestParameters>(params =>
        params.description.requesterAddress == testData.requesterAddress &&
        params.description.ownerAddress == ALICE &&
        params.description.description == testData.description
    )))
        .returns(Promise.resolve(requestByLO.object()));
    repository.setup(instance => instance.save(requestByLO.object()))
        .returns(Promise.resolve());

    mockPolkadotIdentityLoc(repository, hasPolkadotIdentityLoc);
}

function mockModelForCreationWithLogionIdentityLoc(container: Container): void {
    const { factory, repository } = buildMocks(container);

    mockLogionIdentityLoc(repository, true);
    mockPolkadotIdentityLoc(repository, false);

    const request = mockRequest("REQUESTED", { ...testDataWithLogionIdentity, requesterIdentityLocId: testDataWithLogionIdentity.requesterIdentityLoc });
    factory.setup(instance => instance.newLOLocRequest(It.Is<NewLocRequestParameters>(params =>
        params.description.requesterIdentityLoc === userIdentities["Logion"].identityLocId &&
        params.description.ownerAddress == ALICE
    )))
        .returns(Promise.resolve(request.object()));

    repository.setup(instance => instance.save(request.object()))
        .returns(Promise.resolve());
}
