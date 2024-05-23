import { AuthenticationService, TestApp } from "@logion/rest-api-core";
import { Container } from "inversify";
import { SecretRecoveryController } from "../../../src/logion/controllers/secret_recovery.controller.js";
import {
    SecretRecoveryRequestFactory,
    SecretRecoveryRequestDescription, SecretRecoveryRequestAggregateRoot,
    SecretRecoveryRequestRepository
} from "../../../src/logion/model/secret_recovery.model.js";
import { NonTransactionalSecretRecoveryRequestService, SecretRecoveryRequestService } from "../../../src/logion/services/secret_recovery.service.js";
import {
    LocRequestRepository,
    LocRequestAggregateRoot,
    RecoverableSecretEntity
} from "../../../src/logion/model/locrequest.model.js";
import { Mock, It } from "moq.ts";
import request from "supertest";
import { ALICE_ACCOUNT, ALICE } from "../../helpers/addresses.js";
import { DirectoryService } from "../../../src/logion/services/directory.service.js";
import { NotificationService, Template } from "../../../src/logion/services/notification.service.js";
import moment from "moment";
import { notifiedLegalOfficer } from "../services/notification-test-data.js";
import { ValidAccountId } from "@logion/node-api";
import { LocalsObject } from "pug";
import { mockAuthenticationWithAuthenticatedUser } from "@logion/rest-api-core/dist/TestApp.js";
import { UserIdentity } from "src/logion/model/useridentity.js";
import { PostalAddress } from "src/logion/model/postaladdress.js";

const { setupApp, mockLegalOfficerOnNode } = TestApp;

describe("SecretRecoveryController", () => {

    it("creates secret recovery request", async () => {

        const app = setupApp(SecretRecoveryController, mockForCreate);
        await request(app)
            .post('/api/secret-recovery')
            .send({
                ...recoveryRequest,
                requesterIdentityLocId: IDENTITY_LOC_ID,
                secretName: SECRET_NAME,
            })
            .expect(204);
        secretRecoveryRequestRepository.verify(instance => instance.save(secretRecoveryRequest.object()));
    })

    it("fails to create secret recovery request with IDLOC not found", async () => {

        const app = setupApp(SecretRecoveryController, mockForCreate);
        const unknownLocId = "0a765ca1-f0a8-450a-b66a-5dfe9de7adc6";
        await request(app)
            .post('/api/secret-recovery')
            .send({
                ...recoveryRequest,
                requesterIdentityLocId: unknownLocId,
                secretName: SECRET_NAME,
            })
            .expect(400)
            .expect(response => expect(response.body.errorMessage).toEqual("Identity LOC not found"));
    })

    it("fails to create secret recovery request with Secret not found", async () => {

        const app = setupApp(SecretRecoveryController, mockForCreate);
        await request(app)
            .post('/api/secret-recovery')
            .send({
                ...recoveryRequest,
                requesterIdentityLocId: IDENTITY_LOC_ID,
                secretName: "unknown secret",
            })
            .expect(400)
            .expect(response => expect(response.body.errorMessage).toEqual("Secret not found"));
    })

    it("accepts existing secret recovery request", async () => {
        const userMock = mockAuthenticationWithAuthenticatedUser(mockLegalOfficerOnNode(ALICE_ACCOUNT));
        const app = setupApp(SecretRecoveryController, mockForUpdate, userMock);
        await request(app)
            .post(`/api/secret-recovery/${ REQUEST_ID }/accept`)
            .expect(204);
        secretRecoveryRequest.verify(instance => instance.accept(It.IsAny()));
        secretRecoveryRequestRepository.verify(instance => instance.save(secretRecoveryRequest.object()));
    })

    it("rejects existing secret recovery request", async () => {
        const userMock = mockAuthenticationWithAuthenticatedUser(mockLegalOfficerOnNode(ALICE_ACCOUNT));
        const app = setupApp(SecretRecoveryController, mockForUpdate, userMock);
        await request(app)
            .post(`/api/secret-recovery/${ REQUEST_ID }/reject`)
            .send({ rejectReason: "Because." })
            .expect(204);
        secretRecoveryRequest.verify(instance => instance.reject("Because.", It.IsAny()));
        secretRecoveryRequestRepository.verify(instance => instance.save(secretRecoveryRequest.object()));
    })

    it("fetches recovery information", async () => {
        const userMock = mockAuthenticationWithAuthenticatedUser(mockLegalOfficerOnNode(ALICE_ACCOUNT));
        const app = setupApp(SecretRecoveryController, mockForFetch, userMock);
        await request(app)
            .put(`/api/secret-recovery/${ REQUEST_ID }/recovery-info`)
            .expect(200)
            .then(response => {
                expect(response.body.identity1).toBeDefined();
                expect(response.body.identity1.userIdentity).toEqual(USER_IDENTITY);
                expect(response.body.identity1.userPostalAddress).toEqual(USER_POSTAL_ADDRESS);

                expect(response.body.identity2).toBeDefined();
                expect(response.body.identity2.userIdentity).toEqual(USER_IDENTITY);
                expect(response.body.identity2.userPostalAddress).toEqual(USER_POSTAL_ADDRESS);

                expect(response.body.type).toBe("SECRET");
            });
    })
})

function mockForCreate(container: Container) {
    mockForAll(container);

    secretRecoveryRequest.setup(instance => instance.getDescription())
        .returns({
            ...recoveryRequest,
            requesterIdentityLocId: IDENTITY_LOC_ID,
            secretName: SECRET_NAME,
            createdOn: moment(),
            id: REQUEST_ID,
            status: "PENDING",
        });
    secretRecoveryRequestFactory.setup(instance => instance.newSecretRecoveryRequest(It.IsAny<SecretRecoveryRequestDescription>()))
        .returns(secretRecoveryRequest.object());
}

function mockForAll(container: Container) {
    createAndBindMocks(container);

    identityLoc = new Mock<LocRequestAggregateRoot>();
    const secret = new Mock<RecoverableSecretEntity>();
    secret.setup(instance => instance.name)
        .returns(SECRET_NAME);

    identityLoc.setup(instance => instance.secrets)
        .returns([ secret.object() ]);
    identityLoc.setup(instance => instance.getOwner())
        .returns(ALICE_ACCOUNT);

    locRequestRepository.setup(instance => instance.findById(IDENTITY_LOC_ID))
        .returns(Promise.resolve(identityLoc.object()));

    secretRecoveryRequest.setup(instance => instance.getDescription())
        .returns({
            ...recoveryRequest,
            requesterIdentityLocId: IDENTITY_LOC_ID,
            secretName: SECRET_NAME,
            createdOn: moment(),
            id: REQUEST_ID,
            status: "PENDING",
        })
    secretRecoveryRequestFactory.setup(instance => instance.newSecretRecoveryRequest(It.IsAny<SecretRecoveryRequestDescription>()))
        .returns(secretRecoveryRequest.object());

    secretRecoveryRequestRepository.setup(instance => instance.save(It.IsAny()))
        .returns(Promise.resolve());

    mockNotifications();
}

function mockNotifications() {
    directoryService.setup(instance => instance.get(It.IsAny<ValidAccountId>()))
        .returns(Promise.resolve(notifiedLegalOfficer(ALICE)));
    notificationService.setup(instance => instance.notify(
        It.IsAny<string>(),
        It.IsAny<Template>(),
        It.IsAny<LocalsObject>(),
    )).returns(Promise.resolve());
}

const IDENTITY_LOC_ID = "1f95f7e8-022a-4baf-bc90-4796c493dd69";
const SECRET_NAME = "my-secret";
const CHALLENGE = "my-challenge";
const REQUEST_ID = "a7ff4ab6-5bef-4310-9c28-bcbd653565c3";
const USER_IDENTITY: UserIdentity = {
    email: "john.doe@logion.network",
    firstName: "John",
    lastName: "Doe",
    phoneNumber: "+1234",
};
const USER_POSTAL_ADDRESS: PostalAddress = {
    line1: "Rue de la Paix",
        line2: "",
        postalCode: "00000",
        city: "Liège",
        country: "Belgium",
};

const recoveryRequest = {
    challenge: CHALLENGE,
    userIdentity: USER_IDENTITY,
    userPostalAddress: USER_POSTAL_ADDRESS,
}

let identityLoc: Mock<LocRequestAggregateRoot>;
let secretRecoveryRequestFactory: Mock<SecretRecoveryRequestFactory>;
let secretRecoveryRequestRepository: Mock<SecretRecoveryRequestRepository>;
let locRequestRepository: Mock<LocRequestRepository>;
let directoryService: Mock<DirectoryService>;
let notificationService: Mock<NotificationService>;
let secretRecoveryRequest: Mock<SecretRecoveryRequestAggregateRoot>;

function createAndBindMocks(container: Container) {
    secretRecoveryRequest = new Mock<SecretRecoveryRequestAggregateRoot>();
    secretRecoveryRequestFactory = new Mock<SecretRecoveryRequestFactory>();
    container.bind(SecretRecoveryRequestFactory).toConstantValue(secretRecoveryRequestFactory.object());
    secretRecoveryRequestRepository = new Mock<SecretRecoveryRequestRepository>();
    container.bind(SecretRecoveryRequestRepository).toConstantValue(secretRecoveryRequestRepository.object());
    container.bind(SecretRecoveryRequestService).toConstantValue(new NonTransactionalSecretRecoveryRequestService(secretRecoveryRequestRepository.object()));
    locRequestRepository = new Mock<LocRequestRepository>();
    container.bind(LocRequestRepository).toConstantValue(locRequestRepository.object());
    directoryService = new Mock<DirectoryService>();
    container.bind(DirectoryService).toConstantValue(directoryService.object());
    notificationService = new Mock<NotificationService>();
    container.bind(NotificationService).toConstantValue(notificationService.object());
}

function mockForUpdate(container: Container) {
    mockForAll(container);

    secretRecoveryRequest = new Mock<SecretRecoveryRequestAggregateRoot>();
    secretRecoveryRequest.setup(instance => instance.getDescription())
        .returns({
            ...recoveryRequest,
            requesterIdentityLocId: IDENTITY_LOC_ID,
            secretName: SECRET_NAME,
            createdOn: moment(),
            id: REQUEST_ID,
            status: "PENDING",
        });
    secretRecoveryRequest.setup(instance => instance.accept(It.IsAny())).returns();
    secretRecoveryRequest.setup(instance => instance.reject(It.IsAny(), It.IsAny())).returns();

    secretRecoveryRequestRepository.setup(instance => instance.findById(REQUEST_ID))
        .returns(Promise.resolve(secretRecoveryRequest.object()));
}

function mockForFetch(container: Container) {
    mockForAll(container);

    secretRecoveryRequest = new Mock<SecretRecoveryRequestAggregateRoot>();
    secretRecoveryRequest.setup(instance => instance.getDescription())
        .returns({
            ...recoveryRequest,
            requesterIdentityLocId: IDENTITY_LOC_ID,
            secretName: SECRET_NAME,
            createdOn: moment(),
            id: REQUEST_ID,
            status: "PENDING",
        });
    secretRecoveryRequestRepository.setup(instance => instance.findById(REQUEST_ID))
        .returns(Promise.resolve(secretRecoveryRequest.object()));

    identityLoc.setup(instance => instance.getDescription()).returns({
        createdOn: moment().toISOString(),
        description: "",
        fees: {

        },
        locType: "Identity",
        ownerAddress: ALICE_ACCOUNT,
        userIdentity: USER_IDENTITY,
        userPostalAddress: USER_POSTAL_ADDRESS,
    });
}
