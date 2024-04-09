import { TestApp } from "@logion/rest-api-core";
import { LocRequestController } from "../../../src/logion/controllers/locrequest.controller.js";
import { Container } from "inversify";
import request from "supertest";
import { ALICE_ACCOUNT } from "../../helpers/addresses.js";
import { Mock, It, Times } from "moq.ts";
import {
    NewLocRequestParameters,
    LocType,
    NewUserLocRequestParameters,
} from "../../../src/logion/model/locrequest.model.js";
import { NotificationService } from "../../../src/logion/services/notification.service.js";
import {
    testDataWithType,
    userIdentities,
    testDataWithLogionIdentity,
    testDataWithUserIdentityWithType,
    SEAL,
    buildMocks,
    mockRequest,
    mockPolkadotIdentityLoc,
    mockLogionIdentityLoc,
    testData,
    checkPrivateData,
    POLKADOT_REQUESTER,
    EXISTING_SPONSORSHIP_ID,
    ETHEREUM_REQUESTER
} from "./locrequest.controller.shared.js";
import { UUID } from "@logion/node-api";
import { SupportedAccountId } from "../../../src/logion/model/supportedaccountid.model.js";
import { LocalsObject } from "pug";

const { mockAuthenticationForUserOrLegalOfficer, mockAuthenticationFailureWithInvalidSignature, setupApp } = TestApp;

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

    it('user succeeds to create Transaction loc request with existing identity LOC', async () => {
        await testLocRequestCreationWithPolkadotIdentityLoc(false, "Transaction")
    });

    it('user succeeds to create Collection loc request with existing identity LOC', async () => {
        await testLocRequestCreationWithPolkadotIdentityLoc(false, "Collection")
    });

    it('succeeds in creating a draft LOC', async () => {
        const mock = mockAuthenticationForUserOrLegalOfficer(false, POLKADOT_REQUESTER);
        const app = setupApp(
            LocRequestController,
            container => mockModelForCreation(container, "Transaction", undefined, true),
            mock,
        );
        const data = testDataWithType("Transaction", true);
        await request(app)
            .post('/api/loc-request')
            .send({
                ...data,
                fees: { legalFee: data.fees?.legalFee?.toString() },
            })
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
            .send({
                ...testDataWithLogionIdentity,
                ownerAddress: testDataWithLogionIdentity.ownerAddress?.address,
                fees: { legalFee: testDataWithLogionIdentity.fees?.legalFee?.toString() },
            })
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.id).toBeDefined();
                expect(response.body.status).toBe("REVIEW_PENDING");
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
            mockAuthenticationFailureWithInvalidSignature(),
        );
        const data = testDataWithType("Transaction");
        await request(app)
            .post('/api/loc-request')
            .send({
                ...data,
                fees: { legalFee: data.fees?.legalFee?.toString() },
            })
            .expect(401)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.id).toBeUndefined();
            });
    });

    it('fails to create an ID LOC Request with an already used sponsorship ID', async () => {

        const mock = mockAuthenticationForUserOrLegalOfficer(false, ETHEREUM_REQUESTER);
        const app = setupApp(
            LocRequestController,
            container => mockModelForCreation(container, "Identity"),
            mock,
        );
        const data = testDataWithType("Identity");
        await request(app)
            .post('/api/loc-request')
            .send({
                ...data,
                sponsorshipId: EXISTING_SPONSORSHIP_ID.toString(),
                fees: { legalFee: data.fees?.legalFee?.toString() },
            })
            .expect(400)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.errorMessage).toEqual("Error: This sponsorship ID is already used");
            });
    })
});

async function testLocRequestCreationWithEmbeddedUserIdentity(isLegalOfficer: boolean, locType: LocType, expectedStatus: number, expectedErrorMessage?: string, hasPolkadotIdentityLoc: boolean = false) {
    const mock = mockAuthenticationForUserOrLegalOfficer(isLegalOfficer, isLegalOfficer ? undefined : POLKADOT_REQUESTER);
    const app = setupApp(
        LocRequestController,
        container => mockModelForCreation(container, locType, undefined, hasPolkadotIdentityLoc),
        mock
    )
    const expectedUserPrivateData = userIdentities["EmbeddedInLoc"];
    const data = testDataWithUserIdentityWithType(locType);
    await request(app)
        .post('/api/loc-request')
        .send({
            ...data,
            fees: {
                legalFee: data.fees?.legalFee?.toString(),
                valueFee: data.fees?.valueFee?.toString(),
                collectionItemFee: data.fees?.collectionItemFee?.toString(),
                tokensRecordFee: data.fees?.tokensRecordFee?.toString(),
            },
        })
        .expect(expectedStatus)
        .expect('Content-Type', /application\/json/)
        .then(response => {
            if (expectedStatus === 200) {
                expect(response.body.id).toBeDefined();
                expect(response.body.status).toBe("REVIEW_PENDING");
                expect(response.body.locType).toBe(locType);
                checkPrivateData(response, expectedUserPrivateData);
                expect(response.body.seal).toEqual(SEAL.hash.toHex())
            } else {
                expect(response.body.errorMessage).toEqual(expectedErrorMessage);
            }
        });
}

async function testLocRequestCreationWithPolkadotIdentityLoc(isLegalOfficer: boolean, locType: LocType) {
    const mock = mockAuthenticationForUserOrLegalOfficer(isLegalOfficer, isLegalOfficer ? ALICE_ACCOUNT : POLKADOT_REQUESTER);
    const notificationService = new Mock<NotificationService>();
    const app = setupApp(
        LocRequestController,
        container => mockModelForCreation(container, locType, notificationService, true),
        mock,
    )
    const expectedUserPrivateData = userIdentities["Polkadot"];
    const data = testDataWithType(locType);
    await request(app)
        .post('/api/loc-request')
        .send({
            ...data,
            fees: {
                legalFee: data.fees?.legalFee?.toString(),
                valueFee: data.fees?.valueFee?.toString(),
                collectionItemFee: data.fees?.collectionItemFee?.toString(),
                tokensRecordFee: data.fees?.tokensRecordFee?.toString(),
            }
        })
        .expect(200)
        .expect('Content-Type', /application\/json/)
        .then(response => {
            expect(response.body.id).toBeDefined();
            expect(response.body.status).toBe("REVIEW_PENDING");
            expect(response.body.locType).toBe(locType);
            checkPrivateData(response, expectedUserPrivateData);
        });

    if(isLegalOfficer) {
        notificationService.verify(instance => instance.notify, Times.Never());
    } else {
        notificationService.verify(instance => instance.notify("alice@logion.network", "loc-requested", It.Is<LocalsObject>(data => {
            return data.loc.locType === locType
        })));
    }
}

function mockModelForCreation(container: Container, locType: LocType, notificationService: Mock<NotificationService> | undefined = undefined, hasPolkadotIdentityLoc: boolean = false, hasLogionIdentityLoc: boolean = false): void {
    const { factory, repository, sponsorshipService } = buildMocks(container, { notificationService });

    const draft = mockRequest("DRAFT", hasPolkadotIdentityLoc ? testDataWithType(locType) : testDataWithUserIdentityWithType(locType));
    factory.setup(instance => instance.newLocRequest(It.Is<NewUserLocRequestParameters>(params =>
        params.description.requesterAddress?.address === testData.requesterAddress?.address &&
        params.description.requesterAddress?.type === testData.requesterAddress?.type &&
        params.description.ownerAddress.equals(ALICE_ACCOUNT) &&
        params.description.description == testData.description &&
        params.draft
    )))
        .returns(Promise.resolve(draft.object()));
    repository.setup(instance => instance.save(draft.object()))
        .returns(Promise.resolve());

    const requested = mockRequest("REVIEW_PENDING", hasPolkadotIdentityLoc ? testDataWithType(locType) : testDataWithUserIdentityWithType(locType));
    factory.setup(instance => instance.newLocRequest(It.Is<NewUserLocRequestParameters>(params =>
        params.description.requesterAddress?.address === testData.requesterAddress?.address &&
        params.description.requesterAddress?.type === testData.requesterAddress?.type &&
        params.description.ownerAddress.equals(ALICE_ACCOUNT) &&
        params.description.description == testData.description &&
        !params.draft
    )))
        .returns(Promise.resolve(requested.object()));
    repository.setup(instance => instance.save(requested.object()))
        .returns(Promise.resolve());

    const requestByLO = mockRequest("REVIEW_PENDING", hasPolkadotIdentityLoc ? testDataWithType(locType) : testDataWithUserIdentityWithType(locType));
    factory.setup(instance => instance.newLOLocRequest(It.Is<NewLocRequestParameters>(params =>
        params.description.ownerAddress.equals(ALICE_ACCOUNT) &&
        params.description.description == testData.description
    )))
        .returns(Promise.resolve(requestByLO.object()));
    repository.setup(instance => instance.save(requestByLO.object()))
        .returns(Promise.resolve());

    mockPolkadotIdentityLoc(repository, hasPolkadotIdentityLoc);
    mockLogionIdentityLoc(repository, hasLogionIdentityLoc);

    sponsorshipService.setup(instance => instance.validateSponsorship(
        It.Is<UUID>(sponsorshipId => sponsorshipId.toString() === EXISTING_SPONSORSHIP_ID.toString()),
        It.IsAny<SupportedAccountId>(),
        It.IsAny<SupportedAccountId>()
    )).throws(new Error("This sponsorship ID is already used"));
}

function mockModelForCreationWithLogionIdentityLoc(container: Container): void {
    const { factory, repository } = buildMocks(container);

    mockLogionIdentityLoc(repository, true);
    mockPolkadotIdentityLoc(repository, false);

    const request = mockRequest("REVIEW_PENDING", { ...testDataWithLogionIdentity, requesterIdentityLocId: testDataWithLogionIdentity.requesterIdentityLoc });
    factory.setup(instance => instance.newLOLocRequest(It.Is<NewLocRequestParameters>(params =>
        params.description.requesterIdentityLoc === userIdentities["Logion"].identityLocId &&
        params.description.ownerAddress.equals(ALICE_ACCOUNT)
    )))
        .returns(Promise.resolve(request.object()));

    repository.setup(instance => instance.save(request.object()))
        .returns(Promise.resolve());
}
