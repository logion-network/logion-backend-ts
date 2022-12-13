import { Container } from 'inversify';
import { Mock, It } from 'moq.ts';
import request from 'supertest';
import { TestApp } from '@logion/rest-api-core';

import {
    VaultTransferRequestRepository,
    VaultTransferRequestFactory,
    VaultTransferRequestAggregateRoot,
    VaultTransferRequestDescription,
    VaultTransferRequestDecision,
} from '../../../src/logion/model/vaulttransferrequest.model.js';
import { ALICE, BOB } from '../../helpers/addresses.js';
import { VaultTransferRequestController } from '../../../src/logion/controllers/vaulttransferrequest.controller.js';
import { NotificationService, Template } from "../../../src/logion/services/notification.service.js";
import moment from "moment";
import { DirectoryService } from "../../../src/logion/services/directory.service.js";
import { notifiedLegalOfficer } from "../services/notification-test-data.js";
import {
    FetchProtectionRequestsSpecification,
    ProtectionRequestAggregateRoot,
    ProtectionRequestDescription,
    ProtectionRequestRepository
} from '../../../src/logion/model/protectionrequest.model.js';
import { UserIdentity } from '../../../src/logion/model/useridentity.js';
import { PostalAddress } from '../../../src/logion/model/postaladdress.js';
import { NonTransactionalVaultTransferRequestService, VaultTransferRequestService } from '../../../src/logion/services/vaulttransferrequest.service.js';

const { mockAuthenticatedUser, mockAuthenticationWithAuthenticatedUser, mockAuthenticationWithCondition, setupApp } = TestApp;

describe('VaultTransferRequestController', () => {

    it('creates with valid request', async () => {
        const authenticatedUser = mockAuthenticatedUser(true, REQUESTER_ADDRESS);
        const mock = mockAuthenticationWithAuthenticatedUser(authenticatedUser);
        const app = setupApp(VaultTransferRequestController, mockModelForRequest, mock);

        await request(app)
            .post('/api/vault-transfer-request')
            .send({
                requesterAddress: REQUESTER_ADDRESS,
                legalOfficerAddress: ALICE,
                origin: REQUESTER_ADDRESS,
                destination: DESTINATION,
                amount: "1000",
                call: "0x0303005e017e03e2ee7a0a97e2e5df5cd902aa0b976d65eac998889ea40992efc3d254070010a5d4e8",
                block: "4242",
                index: 42
            })
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.id).toBeDefined();
            });

        notificationService.verify(instance => instance.notify(ALICE_LEGAL_OFFICER.userIdentity.email, "vault-transfer-requested", It.Is<any>(() => true)));
    });

    it('fails with empty request', async () => {
        const app = setupApp(VaultTransferRequestController, mockModelForRequest);

        await request(app)
            .post('/api/vault-transfer-request')
            .send({})
            .expect(400)
            .expect('Content-Type', /application\/json/);
    });

    it('returns expected response given specification', async () => {
        const app = setupApp(VaultTransferRequestController, mockModelForFetch);

        await request(app)
            .put('/api/vault-transfer-request')
            .send({
                requesterAddress: "",
                statuses: ["ACCEPTED", "REJECTED"]
            })
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.requests).toBeDefined();
                expect(response.body.requests.length).toBe(1);
                expect(response.body.requests[0].id).toBe(description.id);
                expect(response.body.requests[0].createdOn).toBe(description.createdOn);
                expect(response.body.requests[0].origin).toBe(description.origin);
                expect(response.body.requests[0].destination).toBe(description.destination);
                expect(response.body.requests[0].amount).toBe(description.amount.toString());
                expect(response.body.requests[0].block).toBe(description.timepoint.blockNumber.toString());
                expect(response.body.requests[0].index).toBe(description.timepoint.extrinsicIndex);
                expect(response.body.requests[0].decision.decisionOn).toBe(TIMESTAMP);
                expect(response.body.requests[0].decision.rejectReason).toBe(REJECT_REASON);
                expect(response.body.requests[0].status).toBe("REJECTED");
            });
    });

    it('fails on authentication failure upon fetch', async  () => {
        const mock = mockAuthenticationWithCondition(false);
        const app = setupApp(VaultTransferRequestController, mockModelForFetch, mock);

        await request(app)
            .put('/api/vault-transfer-request')
            .send({
                requesterAddress: "",
                legalOfficerAddress: [ ALICE ],
                decisionStatuses: ["ACCEPTED", "REJECTED"]
            })
            .expect(401);

    });

    it('WithValidAuthentication', async () => {
        const app = setupApp(VaultTransferRequestController, container => mockModelForAcceptOrCancel(container, true));

        await request(app)
            .post('/api/vault-transfer-request/' + REQUEST_ID + "/accept")
            .expect(200);

        notificationService.verify(instance => instance.notify(IDENTITY.email, "vault-transfer-accepted", It.Is<any>(data => {
            return data.vaultTransfer.decision.decisionOn === DECISION_TIMESTAMP
        })))
    });

    it('WithValidAuthentication', async () => {
        const app = setupApp(VaultTransferRequestController, container => mockModelForReject(container, true));

        await request(app)
            .post('/api/vault-transfer-request/' + REQUEST_ID + "/reject")
            .send({
                rejectReason: REJECT_REASON,
            })
            .expect(200)
            .expect('Content-Type', /application\/json/);

        notificationService.verify(instance => instance.notify(IDENTITY.email, "vault-transfer-rejected", It.Is<any>(data => {
            return data.vaultTransfer.decision.rejectReason === REJECT_REASON &&
                data.vaultTransfer.decision.decisionOn === DECISION_TIMESTAMP
        })))
    });

    it('lets requester cancel', async () => {
        const authenticatedUser = mockAuthenticatedUser(true, REQUESTER_ADDRESS);
        const mock = mockAuthenticationWithAuthenticatedUser(authenticatedUser);
        const app = setupApp(VaultTransferRequestController, container => mockModelForAcceptOrCancel(container, true), mock);

        await request(app)
            .post('/api/vault-transfer-request/' + REQUEST_ID + "/cancel")
            .expect(200);

        notificationService.verify(instance => instance.notify(ALICE_LEGAL_OFFICER.userIdentity.email, "vault-transfer-cancelled", It.Is<any>(() => true)));
    });

    it('cancel fails on auth failure', async () => {
        const mock = mockAuthenticationWithCondition(false);
        const app = setupApp(VaultTransferRequestController, container => mockModelForAcceptOrCancel(container, true), mock);

        await request(app)
            .post('/api/vault-transfer-request/' + REQUEST_ID + "/cancel")
            .expect(401);
    });

    it('lets requester resubmit', async () => {
        const authenticatedUser = mockAuthenticatedUser(true, REQUESTER_ADDRESS);
        const mock = mockAuthenticationWithAuthenticatedUser(authenticatedUser);
        const app = setupApp(VaultTransferRequestController, container => mockModelForAcceptOrCancel(container, true), mock);

        await request(app)
            .post('/api/vault-transfer-request/' + REQUEST_ID + "/resubmit")
            .expect(200);

        notificationService.verify(instance => instance.notify(ALICE_LEGAL_OFFICER.userIdentity.email, "vault-transfer-requested", It.Is<any>(() => true)));
    });

    it('cancel fails on auth failure', async () => {
        const mock = mockAuthenticationWithCondition(false);
        const app = setupApp(VaultTransferRequestController, container => mockModelForAcceptOrCancel(container, true), mock);

        await request(app)
            .post('/api/vault-transfer-request/' + REQUEST_ID + "/resubmit")
            .expect(401);
    });
});

const DECISION_TIMESTAMP = moment().toISOString();

function mockModelForReject(container: Container, verifies: boolean): void {
    const vaultTransferRequest = mockVaultTransferRequest();
    vaultTransferRequest.setup(instance => instance.reject).returns(() => {});
    const decision = new Mock<VaultTransferRequestDecision>();
    decision.setup(instance => instance.rejectReason)
        .returns(REJECT_REASON)
    decision.setup(instance => instance.decisionOn)
        .returns(DECISION_TIMESTAMP)
    vaultTransferRequest.setup(instance => instance.decision).returns(decision.object());

    const repository = new Mock<VaultTransferRequestRepository>();
    repository.setup(instance => instance.findById(REQUEST_ID))
        .returns(Promise.resolve(vaultTransferRequest.object()));
    if(verifies) {
        repository.setup(instance => instance.save)
            .returns(() => Promise.resolve());
    }
    container.bind(VaultTransferRequestRepository).toConstantValue(repository.object());

    const factory = new Mock<VaultTransferRequestFactory>();
    container.bind(VaultTransferRequestFactory).toConstantValue(factory.object());
    mockNotificationAndDirectoryService(container, repository);
}

const ALICE_LEGAL_OFFICER = notifiedLegalOfficer(ALICE);

function mockNotificationAndDirectoryService(container: Container, repository: Mock<VaultTransferRequestRepository>) {
    notificationService = new Mock<NotificationService>();
    notificationService
        .setup(instance => instance.notify(It.IsAny<string>(), It.IsAny<Template>(), It.IsAny<any>()))
        .returns(Promise.resolve());
    container.bind(NotificationService).toConstantValue(notificationService.object());

    const directoryService = new Mock<DirectoryService>();
    directoryService
        .setup(instance => instance.get(It.IsAny<string>()))
        .returns(Promise.resolve(ALICE_LEGAL_OFFICER));
    directoryService
        .setup(instance => instance.requireLegalOfficerAddressOnNode(It.IsAny<string>()))
        .returns(Promise.resolve(ALICE));
    container.bind(DirectoryService).toConstantValue(directoryService.object());

    const protectionRequest = new Mock<ProtectionRequestAggregateRoot>();
    protectionRequest.setup(instance => instance.getDescription()).returns(protectionRequestDescription);

    const protectionRequestRepository = new Mock<ProtectionRequestRepository>();
    protectionRequestRepository
        .setup(instance => instance.findBy(It.IsAny<FetchProtectionRequestsSpecification>()))
        .returns(Promise.resolve([ protectionRequest.object() ]));
    container.bind(ProtectionRequestRepository).toConstantValue(protectionRequestRepository.object());

    container.bind(VaultTransferRequestService).toConstantValue(new NonTransactionalVaultTransferRequestService(repository.object()));
}

function mockVaultTransferRequest(): Mock<VaultTransferRequestAggregateRoot> {
    const vaultTransferRequest = new Mock<VaultTransferRequestAggregateRoot>()
    vaultTransferRequest.setup(instance => instance.getDescription()).returns(description)
    return vaultTransferRequest
}

const REQUESTER_ADDRESS = "5H4MvAsobfZ6bBCDyj5dsrWYLrA8HrRzaqa9p61UXtxMhSCY";
const DESTINATION = "5EBxoSssqNo23FvsDeUxjyQScnfEiGxJaNwuwqBH2Twe35BX";
const TIMESTAMP = "2021-06-10T16:25:23.668294";
const REJECT_REASON = "Illegal";
const REQUEST_ID = "716f7a39-b570-42aa-bcf3-52679ce3cb44";

const description: VaultTransferRequestDescription = {
    requesterAddress: REQUESTER_ADDRESS,
    legalOfficerAddress: ALICE,
    id: REQUEST_ID,
    createdOn: moment.now().toString(),
    amount: 1000n,
    origin: REQUESTER_ADDRESS,
    destination: DESTINATION,
    timepoint: {
        blockNumber: 4242n,
        extrinsicIndex: 42
    },
}

const IDENTITY: UserIdentity = {
    email: "john.doe@logion.network",
    firstName: "John",
    lastName: "Doe",
    phoneNumber: "+1234",
};

const POSTAL_ADDRESS: PostalAddress = {
    line1: "Place de le République Française, 10",
    line2: "boite 15",
    postalCode: "4000",
    city: "Liège",
    country: "Belgium"
};

const protectionRequestDescription: ProtectionRequestDescription = {
    addressToRecover: null,
    legalOfficerAddress: ALICE,
    createdOn: TIMESTAMP,
    isRecovery: false,
    otherLegalOfficerAddress: BOB,
    requesterAddress: REQUESTER_ADDRESS,
    userIdentity: IDENTITY,
    userPostalAddress: POSTAL_ADDRESS,
};

function mockModelForFetch(container: Container): void {
    const repository = new Mock<VaultTransferRequestRepository>();

    const vaultTransferRequest = mockVaultTransferRequest()

    const decision = new Mock<VaultTransferRequestDecision>();
    decision.setup(instance => instance.rejectReason).returns(REJECT_REASON);
    decision.setup(instance => instance.decisionOn).returns(TIMESTAMP);
    vaultTransferRequest.setup(instance => instance.decision).returns(decision.object());
    vaultTransferRequest.setup(instance => instance.status).returns('REJECTED');

    const requests: VaultTransferRequestAggregateRoot[] = [ vaultTransferRequest.object() ];
    repository.setup(instance => instance.findBy)
        .returns(() => Promise.resolve(requests));
    container.bind(VaultTransferRequestRepository).toConstantValue(repository.object());

    const factory = new Mock<VaultTransferRequestFactory>();
    container.bind(VaultTransferRequestFactory).toConstantValue(factory.object());
    mockNotificationAndDirectoryService(container, repository);
}

function mockModelForRequest(container: Container): void {
    mockVaultTransferRequestModel(container);
}

function mockVaultTransferRequestModel(container: Container): void {
    const repository = new Mock<VaultTransferRequestRepository>();
    repository.setup(instance => instance.save)
        .returns(() => Promise.resolve());
    container.bind(VaultTransferRequestRepository).toConstantValue(repository.object());

    const factory = new Mock<VaultTransferRequestFactory>();
    const root = mockVaultTransferRequest()
    const decision = new Mock<VaultTransferRequestDecision>();
    root.setup(instance => instance.decision).returns(decision.object());
    factory.setup(instance => instance.newVaultTransferRequest(
            It.Is<VaultTransferRequestDescription>(description =>
                description.requesterAddress === REQUESTER_ADDRESS)))
        .returns(root.object());
    container.bind(VaultTransferRequestFactory).toConstantValue(factory.object());
    mockNotificationAndDirectoryService(container, repository);
}

let notificationService: Mock<NotificationService>;

function mockModelForAcceptOrCancel(container: Container, verifies: boolean): void {
    const vaultTransferRequest = mockVaultTransferRequest();
    vaultTransferRequest.setup(instance => instance.accept(It.IsAny())).returns(undefined);
    vaultTransferRequest.setup(instance => instance.cancel(It.IsAny())).returns(undefined);
    vaultTransferRequest.setup(instance => instance.resubmit()).returns(undefined);
    const decision = new Mock<VaultTransferRequestDecision>();
    decision.setup(instance => instance.decisionOn)
        .returns(DECISION_TIMESTAMP)
    vaultTransferRequest.setup(instance => instance.decision).returns(decision.object());

    const repository = new Mock<VaultTransferRequestRepository>();
    repository.setup(instance => instance.findById(REQUEST_ID))
        .returns(Promise.resolve(vaultTransferRequest.object()));
    if(verifies) {
        repository.setup(instance => instance.save)
            .returns(() => Promise.resolve());
    }
    container.bind(VaultTransferRequestRepository).toConstantValue(repository.object());

    const factory = new Mock<VaultTransferRequestFactory>();
    container.bind(VaultTransferRequestFactory).toConstantValue(factory.object());
    mockNotificationAndDirectoryService(container, repository);
}
