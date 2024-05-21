import { TestApp } from "@logion/rest-api-core";
import { Container } from "inversify";
import { SecretRecoveryController } from "../../../src/logion/controllers/secret_recovery.controller.js";
import {
    SecretRecoveryRequestFactory,
    SecretRecoveryRequestDescription, SecretRecoveryRequestAggregateRoot
} from "../../../src/logion/model/secret_recovery.model.js";
import { SecretRecoveryRequestService } from "../../../src/logion/services/secret_recovery.service.js";
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

const { setupApp } = TestApp;

describe("SecretRecoveryController", () => {

    it("creates secret recovery request", async () => {

        const app = setupApp(SecretRecoveryController, mockDependencies);
        await request(app)
            .post('/api/secret-recovery')
            .send({
                ...recoveryRequest,
                requesterIdentityLocId: IDENTITY_LOC_ID,
                secretName: SECRET_NAME,
            })
            .expect(204);
    })

    it("fails to create secret recovery request with IDLOC not found", async () => {

        const app = setupApp(SecretRecoveryController, mockDependencies);
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

        const app = setupApp(SecretRecoveryController, mockDependencies);
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
})

function mockDependencies(container: Container) {
    createAndBindMocks(container);

    const identityLoc = new Mock<LocRequestAggregateRoot>();
    const secret = new Mock<RecoverableSecretEntity>();
    secret.setup(instance => instance.name)
        .returns(SECRET_NAME);

    identityLoc.setup(instance => instance.secrets)
        .returns([ secret.object() ]);
    identityLoc.setup(instance => instance.getOwner())
        .returns(ALICE_ACCOUNT);

    locRequestRepository.setup(instance => instance.findById(IDENTITY_LOC_ID))
        .returns(Promise.resolve(identityLoc.object()));

    const secretRecoveryRequest = new Mock<SecretRecoveryRequestAggregateRoot>();
    secretRecoveryRequest.setup(instance => instance.getDescription())
        .returns({
            ...recoveryRequest,
            requesterIdentityLocId: IDENTITY_LOC_ID,
            secretName: SECRET_NAME,
            createdOn: moment(),
        })
    secretRecoveryRequestFactory.setup(instance => instance.newSecretRecoveryRequest(It.IsAny<SecretRecoveryRequestDescription>()))
        .returns(secretRecoveryRequest.object());

    secretRecoveryRequestService.setup(instance => instance.add(secretRecoveryRequest.object()))
        .returns(Promise.resolve())

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

const recoveryRequest = {
    challenge: CHALLENGE,
    userIdentity: {
        email: "john.doe@logion.network",
        firstName: "John",
        lastName: "Doe",
        phoneNumber: "+1234",
    },
    userPostalAddress: {
        line1: "Rue de la Paix",
        line2: "",
        postalCode: "00000",
        city: "Liège",
        country: "Belgium",
    },
}

let secretRecoveryRequestFactory: Mock<SecretRecoveryRequestFactory>;
let secretRecoveryRequestService: Mock<SecretRecoveryRequestService>;
let locRequestRepository: Mock<LocRequestRepository>;
let directoryService: Mock<DirectoryService>;
let notificationService: Mock<NotificationService>;

function createAndBindMocks(container: Container) {
    secretRecoveryRequestFactory = new Mock<SecretRecoveryRequestFactory>();
    container.bind(SecretRecoveryRequestFactory).toConstantValue(secretRecoveryRequestFactory.object());
    secretRecoveryRequestService = new Mock<SecretRecoveryRequestService>();
    container.bind(SecretRecoveryRequestService).toConstantValue(secretRecoveryRequestService.object());
    locRequestRepository = new Mock<LocRequestRepository>();
    container.bind(LocRequestRepository).toConstantValue(locRequestRepository.object());
    directoryService = new Mock<DirectoryService>();
    container.bind(DirectoryService).toConstantValue(directoryService.object());
    notificationService = new Mock<NotificationService>();
    container.bind(NotificationService).toConstantValue(notificationService.object());
}
