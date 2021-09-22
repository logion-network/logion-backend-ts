import { Container } from 'inversify';
import { Mock, It } from 'moq.ts';
import request from 'supertest';

import { setupApp } from '../../helpers/testapp';

import {
    ProtectionRequestRepository,
    ProtectionRequestFactory,
    ProtectionRequestAggregateRoot,
    NewProtectionRequestParameters,
    LegalOfficerDecision,
} from '../../../src/logion/model/protectionrequest.model';
import { ALICE, BOB } from '../../../src/logion/model/addresses.model';
import { RecoveryService } from '../../../src/logion/services/recovery.service';
import { ProtectionRequestController } from '../../../src/logion/controllers/protectionrequest.controller';

describe('createProtectionRequest', () => {

    it('success with valid protection request', async () => {
        const app = setupApp(ProtectionRequestController, mockModelForRequest);

        await request(app)
            .post('/api/protection-request')
            .send({
                requesterAddress: REQUESTER_ADDRESS,
                userIdentity: IDENTITY,
                userPostalAddress: POSTAL_ADDRESS,
                legalOfficerAddresses: LEGAL_OFFICERS,
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
                legalOfficerAddresses: LEGAL_OFFICERS,
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

const LEGAL_OFFICERS = [ALICE, BOB];

function mockModelForRequest(container: Container): void {
    mockProtectionRequestModel(container, false, null);
}

function mockProtectionRequestModel(container: Container, isRecovery: boolean, addressToRecover: string | null): void {
    const repository = new Mock<ProtectionRequestRepository>();
    repository.setup(instance => instance.save)
        .returns(() => Promise.resolve());
    container.bind(ProtectionRequestRepository).toConstantValue(repository.object());

    const factory = new Mock<ProtectionRequestFactory>();
    const root = new Mock<ProtectionRequestAggregateRoot>();
    root.setup(instance => instance.decisions)
        .returns([]);
    root.setup(instance => instance.id)
        .returns("id");
    factory.setup(instance => instance.newProtectionRequest(
            It.Is<NewProtectionRequestParameters>(params =>
                params.legalOfficerAddresses.includes(ALICE)
                && params.legalOfficerAddresses.includes(BOB)
                && params.description.addressToRecover === addressToRecover
                && params.description.isRecovery === isRecovery
                && params.description.requesterAddress === REQUESTER_ADDRESS)))
        .returns(root.object());
    container.bind(ProtectionRequestFactory).toConstantValue(factory.object());

    const recoveryService = new Mock<RecoveryService>();
    container.bind(RecoveryService).toConstantValue(recoveryService.object());
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
                legalOfficerAddress: [ ALICE ],
                decisionStatuses: ["ACCEPTEED", "REJECTED"]
            })
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.requests).toBeDefined();
                expect(response.body.requests.length).toBe(1);
                expect(response.body.requests[0].requesterAddress).toBe(REQUESTER_ADDRESS);
                expect(response.body.requests[0].userIdentity.firstName).toBe("John");
                expect(response.body.requests[0].userIdentity.lastName).toBe("Doe");
                expect(response.body.requests[0].userIdentity.email).toBe("john.doe@logion.network");
                expect(response.body.requests[0].userIdentity.phoneNumber).toBe("+1234");
                expect(response.body.requests[0].userPostalAddress.line1).toBe("Place de le République Française, 10");
                expect(response.body.requests[0].userPostalAddress.line2).toBe("boite 15");
                expect(response.body.requests[0].userPostalAddress.postalCode).toBe("4000");
                expect(response.body.requests[0].userPostalAddress.city).toBe("Liège");
                expect(response.body.requests[0].userPostalAddress.country).toBe("Belgium");
                expect(response.body.requests[0].decisions[0].legalOfficerAddress).toBe(ALICE);
                expect(response.body.requests[0].decisions[0].status).toBe("PENDING");
                expect(response.body.requests[0].decisions[0].createdOn).toBe(TIMESTAMP);
                expect(response.body.requests[0].decisions[1].legalOfficerAddress).toBe(BOB);
                expect(response.body.requests[0].decisions[1].status).toBe("REJECTED");
                expect(response.body.requests[0].decisions[1].rejectReason).toBe(REJECT_REASON);
                expect(response.body.requests[0].decisions[1].createdOn).toBe(TIMESTAMP);
                expect(response.body.requests[0].decisions[1].decisionOn).toBe(TIMESTAMP);
                expect(response.body.requests[0].createdOn).toBe(TIMESTAMP);
                expect(response.body.requests[0].isRecovery).toBe(false);
                expect(response.body.requests[0].status).toBe("PENDING");
            });
    });

    it('fails on authentication failure', async  () => {
        const app = setupApp(ProtectionRequestController, mockModelForFetch, false);

        await request(app)
            .put('/api/protection-request')
            .send({
                requesterAddress: "",
                legalOfficerAddress: [ ALICE ],
                decisionStatuses: ["ACCEPTEED", "REJECTED"]
            })
            .expect(401);

    });

});

const REQUESTER_ADDRESS = "5H4MvAsobfZ6bBCDyj5dsrWYLrA8HrRzaqa9p61UXtxMhSCY";
const TIMESTAMP = "2021-06-10T16:25:23.668294";
const REJECT_REASON = "Illegal";

function mockModelForFetch(container: Container): void {
    const repository = new Mock<ProtectionRequestRepository>();

    const protectionRequest = new Mock<ProtectionRequestAggregateRoot>();
    protectionRequest.setup(instance => instance.requesterAddress).returns(REQUESTER_ADDRESS);

    protectionRequest.setup(instance => instance.firstName).returns("John");
    protectionRequest.setup(instance => instance.lastName).returns("Doe");
    protectionRequest.setup(instance => instance.email).returns("john.doe@logion.network");
    protectionRequest.setup(instance => instance.phoneNumber).returns("+1234");

    protectionRequest.setup(instance => instance.line1).returns("Place de le République Française, 10");
    protectionRequest.setup(instance => instance.line2).returns("boite 15");
    protectionRequest.setup(instance => instance.postalCode).returns("4000");
    protectionRequest.setup(instance => instance.city).returns("Liège");
    protectionRequest.setup(instance => instance.country).returns("Belgium");

    const decisionAlice = new Mock<LegalOfficerDecision>();
    decisionAlice.setup(instance => instance.legalOfficerAddress).returns(ALICE);
    decisionAlice.setup(instance => instance.status).returns('PENDING');
    decisionAlice.setup(instance => instance.createdOn).returns(TIMESTAMP);

    const decisionBob = new Mock<LegalOfficerDecision>();
    decisionBob.setup(instance => instance.legalOfficerAddress).returns(BOB);
    decisionBob.setup(instance => instance.status).returns('REJECTED');
    decisionBob.setup(instance => instance.rejectReason).returns(REJECT_REASON);
    decisionBob.setup(instance => instance.createdOn).returns(TIMESTAMP);
    decisionBob.setup(instance => instance.decisionOn).returns(TIMESTAMP);

    protectionRequest.setup(instance => instance.decisions).returns([ decisionAlice.object(), decisionBob.object() ]);
    protectionRequest.setup(instance => instance.createdOn).returns(TIMESTAMP);
    protectionRequest.setup(instance => instance.isRecovery).returns(false);
    protectionRequest.setup(instance => instance.addressToRecover).returns(null);
    protectionRequest.setup(instance => instance.status).returns('PENDING');

    const requests: ProtectionRequestAggregateRoot[] = [ protectionRequest.object() ];
    repository.setup(instance => instance.findBy)
        .returns(() => Promise.resolve(requests));
    container.bind(ProtectionRequestRepository).toConstantValue(repository.object());

    const factory = new Mock<ProtectionRequestFactory>();
    container.bind(ProtectionRequestFactory).toConstantValue(factory.object());

    const recoveryService = new Mock<RecoveryService>();
    container.bind(RecoveryService).toConstantValue(recoveryService.object());
}

describe('acceptProtectionRequest', () => {

    it('WithValidAuthentication', async () => {
        const app = setupApp(ProtectionRequestController, container => mockModelForAccept(container, true));

        await request(app)
            .post('/api/protection-request/' + REQUEST_ID + "/accept")
            .send({
                legalOfficerAddress: ALICE,
            })
            .expect(200)
            .expect('Content-Type', /application\/json/);
    });
});

function mockModelForAccept(container: Container, verifies: boolean): void {
    const protectionRequest = new Mock<ProtectionRequestAggregateRoot>();
    protectionRequest.setup(instance => instance.id).returns(REQUEST_ID);
    protectionRequest.setup(instance => instance.accept).returns(() => {});
    protectionRequest.setup(instance => instance.decisions).returns([]);

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

    const recoveryService = new Mock<RecoveryService>();
    container.bind(RecoveryService).toConstantValue(recoveryService.object());
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
    });
});

function mockModelForReject(container: Container, verifies: boolean): void {
    const protectionRequest = new Mock<ProtectionRequestAggregateRoot>();
    protectionRequest.setup(instance => instance.id).returns(REQUEST_ID);
    protectionRequest.setup(instance => instance.reject).returns(() => {});
    protectionRequest.setup(instance => instance.decisions).returns([]);

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

    const recoveryService = new Mock<RecoveryService>();
    container.bind(RecoveryService).toConstantValue(recoveryService.object());
}
