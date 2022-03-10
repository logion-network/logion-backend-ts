import { Container } from 'inversify';
import { Mock, It } from 'moq.ts';
import request from 'supertest';

import { setupApp } from '../../helpers/testapp';

import {
    ProtectionRequestRepository,
    ProtectionRequestFactory,
    ProtectionRequestAggregateRoot,
    NewProtectionRequestParameters,
    ProtectionRequestDescription,
    LegalOfficerDecision,
    LegalOfficerDecisionDescription,
} from '../../../src/logion/model/protectionrequest.model';
import { ALICE } from '../../helpers/addresses';
import { ProtectionRequestController } from '../../../src/logion/controllers/protectionrequest.controller';
import { NotificationService, Template } from "../../../src/logion/services/notification.service";
import { now } from "moment";
import { DirectoryService } from "../../../src/logion/services/directory.service";
import { notifiedLegalOfficer } from "../services/notification-test-data";

const DECISION_TIMESTAMP = "2021-06-10T16:25:23.668294"

describe('createProtectionRequest', () => {

    it('success with valid protection request', async () => {
        const app = setupApp(ProtectionRequestController, mockModelForRequest);

        await request(app)
            .post('/api/protection-request')
            .send({
                requesterAddress: REQUESTER_ADDRESS,
                userIdentity: IDENTITY,
                userPostalAddress: POSTAL_ADDRESS,
                isRecovery: false,
                addressToRecover: null,
            })
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.id).toBeDefined();
            });
    });

    it('success with valid recovery request', async () => {
        const addressToRecover = "toRecover";
        const app = setupApp(ProtectionRequestController, container => mockModelForRecovery(container, addressToRecover));

        await request(app)
            .post('/api/protection-request')
            .send({
                requesterAddress: REQUESTER_ADDRESS,
                userIdentity: IDENTITY,
                userPostalAddress: POSTAL_ADDRESS,
                isRecovery: true,
                addressToRecover,
            })
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.id).toBeDefined();
            });
    });

    it('failure with empty request', async () => {
        const app = setupApp(ProtectionRequestController, mockModelForRequest);

        await request(app)
            .post('/api/protection-request')
            .send({})
            .expect(500)
            .expect('Content-Type', /application\/json/);
    });
});

const IDENTITY = {
    email: "john.doe@logion.network",
    firstName: "John",
    lastName: "Doe",
    phoneNumber: "+1234"
};

const POSTAL_ADDRESS = {
    line1: "Place de le République Française, 10",
    line2: "boite 15",
    postalCode: "4000",
    city: "Liège",
    country: "Belgium"
};

function mockModelForRequest(container: Container): void {
    mockProtectionRequestModel(container, false, null);
}

function mockProtectionRequestModel(container: Container, isRecovery: boolean, addressToRecover: string | null): void {
    const repository = new Mock<ProtectionRequestRepository>();
    repository.setup(instance => instance.save)
        .returns(() => Promise.resolve());
    container.bind(ProtectionRequestRepository).toConstantValue(repository.object());

    const factory = new Mock<ProtectionRequestFactory>();
    const root = mockProtectionRequest()
    mockDecision(root, undefined)

    factory.setup(instance => instance.newProtectionRequest(
            It.Is<NewProtectionRequestParameters>(params =>
                params.description.addressToRecover === addressToRecover
                && params.description.isRecovery === isRecovery
                && params.description.requesterAddress === REQUESTER_ADDRESS)))
        .returns(root.object());
    container.bind(ProtectionRequestFactory).toConstantValue(factory.object());
    mockNotificationAndDirectoryService(container)
}

function mockModelForRecovery(container: Container, addressToRecover: string): void {
    mockProtectionRequestModel(container, true, addressToRecover);
}

describe('fetchProtectionRequests', () => {

    it('returns expected response', async () => {
        const app = setupApp(ProtectionRequestController, mockModelForFetch);

        await request(app)
            .put('/api/protection-request')
            .send({
                requesterAddress: "",
                statuses: ["ACCEPTED", "REJECTED"]
            })
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.requests).toBeDefined();
                expect(response.body.requests.length).toBe(1);
                expect(response.body.requests[0].requesterAddress).toBe(REQUESTER_ADDRESS);
                expect(response.body.requests[0].legalOfficerAddress).toBe(ALICE);
                expect(response.body.requests[0].userIdentity.firstName).toBe("John");
                expect(response.body.requests[0].userIdentity.lastName).toBe("Doe");
                expect(response.body.requests[0].userIdentity.email).toBe("john.doe@logion.network");
                expect(response.body.requests[0].userIdentity.phoneNumber).toBe("+1234");
                expect(response.body.requests[0].userPostalAddress.line1).toBe("Place de le République Française, 10");
                expect(response.body.requests[0].userPostalAddress.line2).toBe("boite 15");
                expect(response.body.requests[0].userPostalAddress.postalCode).toBe("4000");
                expect(response.body.requests[0].userPostalAddress.city).toBe("Liège");
                expect(response.body.requests[0].userPostalAddress.country).toBe("Belgium");
                expect(response.body.requests[0].decision.rejectReason).toBe(REJECT_REASON);
                expect(response.body.requests[0].decision.decisionOn).toBe(TIMESTAMP);
                expect(response.body.requests[0].createdOn).toBe(TIMESTAMP);
                expect(response.body.requests[0].isRecovery).toBe(false);
                expect(response.body.requests[0].status).toBe("REJECTED");
            });
    });

    it('fails on authentication failure', async  () => {
        const app = setupApp(ProtectionRequestController, mockModelForFetch, false);

        await request(app)
            .put('/api/protection-request')
            .send({
                requesterAddress: "",
                legalOfficerAddress: [ ALICE ],
                decisionStatuses: ["ACCEPTED", "REJECTED"]
            })
            .expect(401);

    });

});

const REQUESTER_ADDRESS = "5H4MvAsobfZ6bBCDyj5dsrWYLrA8HrRzaqa9p61UXtxMhSCY";
const TIMESTAMP = "2021-06-10T16:25:23.668294";
const REJECT_REASON = "Illegal";

function mockModelForFetch(container: Container): void {
    const repository = new Mock<ProtectionRequestRepository>();

    const protectionRequest = mockProtectionRequest()

    mockDecision(protectionRequest, {
        rejectReason: REJECT_REASON,
        decisionOn: DECISION_TIMESTAMP
    })

    protectionRequest.setup(instance => instance.createdOn).returns(TIMESTAMP);
    protectionRequest.setup(instance => instance.isRecovery).returns(false);
    protectionRequest.setup(instance => instance.addressToRecover).returns(null);
    protectionRequest.setup(instance => instance.status).returns('REJECTED');

    const requests: ProtectionRequestAggregateRoot[] = [ protectionRequest.object() ];
    repository.setup(instance => instance.findBy)
        .returns(() => Promise.resolve(requests));
    container.bind(ProtectionRequestRepository).toConstantValue(repository.object());

    const factory = new Mock<ProtectionRequestFactory>();
    container.bind(ProtectionRequestFactory).toConstantValue(factory.object());
    mockNotificationAndDirectoryService(container)
}

describe('acceptProtectionRequest', () => {

    it('WithValidAuthentication', async () => {
        const app = setupApp(ProtectionRequestController, container => mockModelForAccept(container, true));

        await request(app)
            .post('/api/protection-request/' + REQUEST_ID + "/accept")
            .send({
                locId: "locId"
            })
            .expect(200)
            .expect('Content-Type', /application\/json/);

        notificationService.verify(instance => instance.notify(IDENTITY.email, "protection-accepted", It.Is<any>(data => {
            return data.protection.decision.decisionOn === DECISION_TIMESTAMP
        })))
    });
});

let notificationService: Mock<NotificationService>;

function mockModelForAccept(container: Container, verifies: boolean): void {
    const protectionRequest = mockProtectionRequest();
    protectionRequest.setup(instance => instance.accept(
        It.IsAny(), It.Is<string>(locId => locId !== undefined && locId !== null))).returns(undefined);

    mockDecision(protectionRequest, { decisionOn: DECISION_TIMESTAMP} )

    const repository = new Mock<ProtectionRequestRepository>();
    repository.setup(instance => instance.findById(REQUEST_ID))
        .returns(Promise.resolve(protectionRequest.object()));
    if(verifies) {
        repository.setup(instance => instance.save)
            .returns(() => Promise.resolve());
    }
    container.bind(ProtectionRequestRepository).toConstantValue(repository.object());

    const factory = new Mock<ProtectionRequestFactory>();
    container.bind(ProtectionRequestFactory).toConstantValue(factory.object());
    mockNotificationAndDirectoryService(container)
}

const REQUEST_ID = "requestId";

describe('rejectProtectionRequest', () => {

    it('WithValidAuthentication', async () => {
        const app = setupApp(ProtectionRequestController, container => mockModelForReject(container, true));

        await request(app)
            .post('/api/protection-request/' + REQUEST_ID + "/reject")
            .send({
                legalOfficerAddress: ALICE,
                rejectReason: REJECT_REASON,
            })
            .expect(200)
            .expect('Content-Type', /application\/json/);

        notificationService.verify(instance => instance.notify(IDENTITY.email, "protection-rejected", It.Is<any>(data => {
            return data.protection.decision.rejectReason === REJECT_REASON &&
                data.protection.decision.decisionOn === DECISION_TIMESTAMP
        })))
    });
});

function mockDecision(protectionRequest: Mock<ProtectionRequestAggregateRoot>, decisionDescription: LegalOfficerDecisionDescription | undefined) {
    const decision = new Mock<LegalOfficerDecision>();
    if (decisionDescription) {
        decision.setup(instance => instance.rejectReason)
            .returns(decisionDescription.rejectReason)
        decision.setup(instance => instance.decisionOn)
            .returns(decisionDescription.decisionOn)
        decision.setup(instance => instance.locId)
            .returns(decisionDescription.locId)
    }
    protectionRequest.setup(instance => instance.decision)
        .returns(decision.object());
    protectionRequest.setup(instance => instance.getDecision())
        .returns(decisionDescription)
}

function mockModelForReject(container: Container, verifies: boolean): void {
    const protectionRequest = mockProtectionRequest();
    protectionRequest.setup(instance => instance.reject).returns(() => {});

    mockDecision(protectionRequest, {
        rejectReason: REJECT_REASON,
        decisionOn: DECISION_TIMESTAMP
    })

    const repository = new Mock<ProtectionRequestRepository>();
    repository.setup(instance => instance.findById(REQUEST_ID))
        .returns(Promise.resolve(protectionRequest.object()));
    if(verifies) {
        repository.setup(instance => instance.save)
            .returns(() => Promise.resolve());
    }
    container.bind(ProtectionRequestRepository).toConstantValue(repository.object());

    const factory = new Mock<ProtectionRequestFactory>();
    container.bind(ProtectionRequestFactory).toConstantValue(factory.object());
    mockNotificationAndDirectoryService(container)
}

function mockNotificationAndDirectoryService(container: Container) {
    notificationService = new Mock<NotificationService>();
    notificationService
        .setup(instance => instance.notify(It.IsAny<string>(), It.IsAny<Template>(), It.IsAny<any>()))
        .returns(Promise.resolve())
    container.bind(NotificationService).toConstantValue(notificationService.object())

    const directoryService = new Mock<DirectoryService>();
    directoryService
        .setup(instance => instance.get(It.IsAny<string>()))
        .returns(Promise.resolve(notifiedLegalOfficer(ALICE)))
    container.bind(DirectoryService).toConstantValue(directoryService.object())
}

function mockProtectionRequest(): Mock<ProtectionRequestAggregateRoot> {

    const description: ProtectionRequestDescription = {
        requesterAddress: REQUESTER_ADDRESS,
        isRecovery: false,
        otherLegalOfficerAddress: "",
        createdOn: now().toString(),
        addressToRecover: null,
        userIdentity: IDENTITY,
        userPostalAddress: POSTAL_ADDRESS
    }
    const protectionRequest = new Mock<ProtectionRequestAggregateRoot>()
    protectionRequest.setup(instance => instance.id).returns(REQUEST_ID)
    protectionRequest.setup(instance => instance.requesterAddress).returns(description.requesterAddress)
    protectionRequest.setup(instance => instance.isRecovery).returns(description.isRecovery)
    protectionRequest.setup(instance => instance.otherLegalOfficerAddress).returns(description.otherLegalOfficerAddress)
    const userIdentity = description.userIdentity
    protectionRequest.setup(instance => instance.firstName).returns(userIdentity.firstName);
    protectionRequest.setup(instance => instance.lastName).returns(userIdentity.lastName);
    protectionRequest.setup(instance => instance.email).returns(userIdentity.email);
    protectionRequest.setup(instance => instance.phoneNumber).returns(userIdentity.phoneNumber);
    const userPostalAddress = description.userPostalAddress
    protectionRequest.setup(instance => instance.line1).returns(userPostalAddress.line1);
    protectionRequest.setup(instance => instance.line2).returns(userPostalAddress.line2);
    protectionRequest.setup(instance => instance.postalCode).returns(userPostalAddress.postalCode);
    protectionRequest.setup(instance => instance.city).returns(userPostalAddress.city);
    protectionRequest.setup(instance => instance.country).returns(userPostalAddress.country);

    protectionRequest.setup(instance => instance.getDescription()).returns(description)
    return protectionRequest
}
