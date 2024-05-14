import { Container } from 'inversify';
import { Mock, It, Times } from 'moq.ts';
import request from 'supertest';

import { TestApp } from '@logion/rest-api-core';

import {
    ProtectionRequestRepository,
    ProtectionRequestFactory,
    ProtectionRequestAggregateRoot,
    NewProtectionRequestParameters,
    ProtectionRequestDescription,
    LegalOfficerDecision,
    LegalOfficerDecisionDescription,
} from '../../../src/logion/model/protectionrequest.model.js';
import { ALICE, BOB, CHARLY, BOB_ACCOUNT, ALICE_ACCOUNT, CHARLY_ACCOUNT } from '../../helpers/addresses.js';
import { ProtectionRequestController } from '../../../src/logion/controllers/protectionrequest.controller.js';
import { NotificationService, Template } from "../../../src/logion/services/notification.service.js";
import moment from "moment";
import { DirectoryService } from "../../../src/logion/services/directory.service.js";
import { notifiedLegalOfficer } from "../services/notification-test-data.js";
import { UserIdentity } from '../../../src/logion/model/useridentity.js';
import { PostalAddress } from '../../../src/logion/model/postaladdress.js';
import { NonTransactionalProtectionRequestService, ProtectionRequestService } from '../../../src/logion/services/protectionrequest.service.js';
import { LocRequestAggregateRoot, LocRequestRepository } from "../../../src/logion/model/locrequest.model.js";
import { LocRequestAdapter } from "../../../src/logion/controllers/adapters/locrequestadapter.js";
import { ValidAccountId } from "@logion/node-api";
import { DB_SS58_PREFIX } from "../../../src/logion/model/supportedaccountid.model.js";
import { LocRequestDescription } from 'src/logion/model/loc_vos.js';

const DECISION_TIMESTAMP = "2021-06-10T16:25:23.668294";
const { mockAuthenticationWithCondition, setupApp, mockLegalOfficerOnNode, mockAuthenticationWithAuthenticatedUser, mockAuthenticatedUser } = TestApp;

describe('createProtectionRequest', () => {

    it('success with valid protection request', async () => {
        const app = setupApp(
            ProtectionRequestController,
            mockModelForRequest,
            mockAuthenticationWithAuthenticatedUser(mockAuthenticatedUser(true, REQUESTER))
        );

        await request(app)
            .post('/api/protection-request')
            .send({
                requesterIdentityLoc: REQUESTER_IDENTITY_LOC_ID,
                legalOfficerAddress: ALICE,
                otherLegalOfficerAddress: BOB,
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
        const addressToRecover = "vQvrwS6w8eXorsbsH4cp6YdNtEegZYH9CvhHZizV2p9dPGyDJ";
        const app = setupApp(
            ProtectionRequestController,
            container => mockModelForRecovery(container, addressToRecover),
            mockAuthenticationWithAuthenticatedUser(mockAuthenticatedUser(true, REQUESTER))
        );

        await request(app)
            .post('/api/protection-request')
            .send({
                requesterIdentityLoc: REQUESTER_IDENTITY_LOC_ID,
                legalOfficerAddress: ALICE,
                otherLegalOfficerAddress: BOB,
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

function mockModelForRequest(container: Container): void {
    mockProtectionRequestModel(container, false, null);
}

function mockProtectionRequestModel(container: Container, isRecovery: boolean, addressToRecover: ValidAccountId | null): void {
    const repository = new Mock<ProtectionRequestRepository>();
    repository.setup(instance => instance.save)
        .returns(() => Promise.resolve());
    container.bind(ProtectionRequestRepository).toConstantValue(repository.object());

    const factory = new Mock<ProtectionRequestFactory>();
    const root = mockProtectionRequest()
    mockDecision(root, undefined)
    const identityLoc = mockIdentityLoc();
    root.setup(instance => instance.requesterIdentityLocId)
        .returns(identityLoc.id)

    if (addressToRecover === null) {
        factory.setup(instance => instance.newProtectionRequest(
            It.Is<NewProtectionRequestParameters>(params => {
                return params.addressToRecover === null
                    && params.isRecovery === isRecovery
                    && params.requesterAddress.equals(REQUESTER)
            })))
            .returns(Promise.resolve(root.object()));
    } else {
        factory.setup(instance => instance.newProtectionRequest(
            It.Is<NewProtectionRequestParameters>(params => {
                return params.addressToRecover !== null
                    && params.addressToRecover?.equals(addressToRecover)
                    && params.isRecovery === isRecovery
                    && params.requesterAddress.equals(REQUESTER)
            })))
            .returns(Promise.resolve(root.object()));
    }
    container.bind(ProtectionRequestFactory).toConstantValue(factory.object());
    mockNotificationAndDirectoryService(container);

    container.bind(ProtectionRequestService).toConstantValue(new NonTransactionalProtectionRequestService(repository.object()));
    container.bind(LocRequestAdapter).toConstantValue(mockLocRequestAdapter());
    container.bind(LocRequestRepository).toConstantValue(mockLocRequestRepository());
}

function mockLocRequestAdapter(): LocRequestAdapter {
    const locRequestAdapter = new Mock<LocRequestAdapter>();
    locRequestAdapter.setup(instance => instance.getUserPrivateData(REQUESTER_IDENTITY_LOC_ID))
        .returns(Promise.resolve({
            userIdentity: IDENTITY,
            userPostalAddress: POSTAL_ADDRESS,
            identityLocId: REQUESTER_IDENTITY_LOC_ID
        }))
    return locRequestAdapter.object();
}

function mockLocRequestRepository(): LocRequestRepository {
    const repository = new Mock<LocRequestRepository>();
    return repository.object();
}

function mockIdentityLoc(): LocRequestAggregateRoot {
    const identityLoc = new Mock<LocRequestAggregateRoot>();
    const description = {
        userIdentity: IDENTITY,
        userPostalAddress: POSTAL_ADDRESS,
    }
    identityLoc.setup(instance => instance.id)
        .returns(REQUESTER_IDENTITY_LOC_ID);
    identityLoc.setup(instance => instance.getDescription())
        .returns(description as LocRequestDescription)
    return identityLoc.object()
}

function mockModelForRecovery(container: Container, addressToRecover: string): void {
    mockProtectionRequestModel(container, true, ValidAccountId.polkadot(addressToRecover));
}

describe('fetchProtectionRequests', () => {

    it('returns expected response', async () => {
        const app = setupApp(ProtectionRequestController, mockModelForFetch);

        await request(app)
            .put('/api/protection-request')
            .send({
                requesterAddress: REQUESTER.address,
                statuses: ["ACCEPTED", "REJECTED"]
            })
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.requests).toBeDefined();
                expect(response.body.requests.length).toBe(1);
                expect(response.body.requests[0].requesterAddress).toBe(REQUESTER.address);
                expect(response.body.requests[0].requesterIdentityLoc).toBe(REQUESTER_IDENTITY_LOC_ID);
                expect(response.body.requests[0].legalOfficerAddress).toBe(ALICE_ACCOUNT.address);
                expect(response.body.requests[0].otherLegalOfficerAddress).toBe(BOB_ACCOUNT.address);
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
        const mock = mockAuthenticationWithCondition(false);
        const app = setupApp(ProtectionRequestController, mockModelForFetch, mock);

        await request(app)
            .put('/api/protection-request')
            .send({
                requesterAddress: REQUESTER.address,
                legalOfficerAddress: ALICE,
                decisionStatuses: ["ACCEPTED", "REJECTED"]
            })
            .expect(401);

    });

});

const REQUESTER = ValidAccountId.polkadot("5H4MvAsobfZ6bBCDyj5dsrWYLrA8HrRzaqa9p61UXtxMhSCY");
const REQUESTER_IDENTITY_LOC_ID = "77c2fef4-6f1d-44a1-a49d-3485c2eb06ee";
const TIMESTAMP = "2021-06-10T16:25:23.668294";
const REJECT_REASON = "Illegal";

function mockModelForFetch(container: Container): void {
    const repository = new Mock<ProtectionRequestRepository>();

    const protectionRequest = mockProtectionRequest()

    mockDecision(protectionRequest, {
        rejectReason: REJECT_REASON,
        decisionOn: DECISION_TIMESTAMP
    })

    protectionRequest.setup(instance => instance.legalOfficerAddress).returns(ALICE_ACCOUNT.getAddress(DB_SS58_PREFIX));
    protectionRequest.setup(instance => instance.createdOn).returns(TIMESTAMP);
    protectionRequest.setup(instance => instance.isRecovery).returns(false);
    protectionRequest.setup(instance => instance.addressToRecover).returns(null);
    protectionRequest.setup(instance => instance.status).returns('REJECTED');
    const identityLoc = mockIdentityLoc();
    protectionRequest.setup(instance => instance.requesterIdentityLocId).returns(identityLoc.id);

    const requests: ProtectionRequestAggregateRoot[] = [ protectionRequest.object() ];
    repository.setup(instance => instance.findBy)
        .returns(() => Promise.resolve(requests));
    container.bind(ProtectionRequestRepository).toConstantValue(repository.object());

    const factory = new Mock<ProtectionRequestFactory>();
    container.bind(ProtectionRequestFactory).toConstantValue(factory.object());
    mockNotificationAndDirectoryService(container)

    container.bind(ProtectionRequestService).toConstantValue(new NonTransactionalProtectionRequestService(repository.object()));
    container.bind(LocRequestAdapter).toConstantValue(mockLocRequestAdapter());
    container.bind(LocRequestRepository).toConstantValue(mockLocRequestRepository());
}

function authenticatedLLONotProtectingUser() {
    const authenticatedUser = mockLegalOfficerOnNode(BOB_ACCOUNT);
    return mockAuthenticationWithAuthenticatedUser(authenticatedUser);
}

describe('acceptProtectionRequest', () => {

    it('protecting LLO accepts', async () => {
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

    it('non-protecting LLO fails to accept', async () => {
        const app = setupApp(ProtectionRequestController, container => mockModelForAccept(container, true), authenticatedLLONotProtectingUser());

        await request(app)
            .post('/api/protection-request/' + REQUEST_ID + "/accept")
            .send({
                locId: "locId"
            })
            .expect(401)

        notificationService.verify(instance => instance.notify, Times.Never());
    });
});

let notificationService: Mock<NotificationService>;

function mockModelForAccept(container: Container, verifies: boolean): void {
    const protectionRequest = mockProtectionRequest();
    protectionRequest.setup(instance => instance.accept(It.IsAny()))
        .returns(undefined);

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
    mockNotificationAndDirectoryService(container);

    container.bind(ProtectionRequestService).toConstantValue(new NonTransactionalProtectionRequestService(repository.object()));
    container.bind(LocRequestAdapter).toConstantValue(mockLocRequestAdapter());
    container.bind(LocRequestRepository).toConstantValue(mockLocRequestRepository());
}

const REQUEST_ID = "requestId";

describe('rejectProtectionRequest', () => {

    it('protecting LLO rejects', async () => {
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

    it('non-protecting LLO fails to reject', async () => {
        const app = setupApp(ProtectionRequestController, container => mockModelForReject(container, true), authenticatedLLONotProtectingUser());

        await request(app)
            .post('/api/protection-request/' + REQUEST_ID + "/reject")
            .send({
                legalOfficerAddress: ALICE,
                rejectReason: REJECT_REASON,
            })
            .expect(401);

        notificationService.verify(instance => instance.notify, Times.Never());
    });
});

describe("User", () => {

    let protectionRequest: Mock<ProtectionRequestAggregateRoot>;
    let repository = new Mock<ProtectionRequestRepository>();


    beforeEach(() => {
        protectionRequest = mockProtectionRequest();
        repository = new Mock<ProtectionRequestRepository>();
    })

    it('re-submits', async () => {
        const app = setupApp(ProtectionRequestController, container => mockModelForUserResubmit(container, protectionRequest, repository));

        await request(app)
            .post('/api/protection-request/' + REQUEST_ID + "/resubmit")
            .send()
            .expect(204);

        notificationService.verify(instance => instance.notify("alice@logion.network", "protection-resubmitted", It.IsAny<any>()))
        protectionRequest.verify(instance => instance.resubmit())
        repository.verify(instance => instance.save(protectionRequest.object()));
    });

    it('fails to re-submit when auth fails', async () => {
        const mock = mockAuthenticationWithCondition(false);
        const app = setupApp(ProtectionRequestController, container => mockModelForUserResubmit(container, protectionRequest, repository), mock);

        await request(app)
            .post('/api/protection-request/' + REQUEST_ID + "/resubmit")
            .send()
            .expect(401);
        protectionRequest.verify(instance => instance.resubmit(), Times.Never())
    });

    it('cancels', async () => {
        const app = setupApp(ProtectionRequestController, container => mockModelForUserCancel(container, protectionRequest, repository));

        await request(app)
            .post('/api/protection-request/' + REQUEST_ID + "/cancel")
            .send()
            .expect(204);

        notificationService.verify(instance => instance.notify("alice@logion.network", "protection-cancelled", It.IsAny<any>()))
        protectionRequest.verify(instance => instance.cancel())
        repository.verify(instance => instance.save(protectionRequest.object()));
    });

    it('fails to cancel when auth fails', async () => {
        const mock = mockAuthenticationWithCondition(false);
        const app = setupApp(ProtectionRequestController, container => mockModelForUserCancel(container, protectionRequest, repository), mock);

        await request(app)
            .post('/api/protection-request/' + REQUEST_ID + "/cancel")
            .send()
            .expect(401);
        protectionRequest.verify(instance => instance.cancel(), Times.Never())
    });

    it('updates', async () => {
        const app = setupApp(ProtectionRequestController, container => mockModelForUserUpdate(container, protectionRequest, repository));

        await request(app)
            .put('/api/protection-request/' + REQUEST_ID + "/update")
            .send({
                otherLegalOfficerAddress: CHARLY
            })
            .expect(204);

        notificationService.verify(instance => instance.notify("alice@logion.network", "protection-updated", It.IsAny<any>()))
        protectionRequest.verify(instance => instance.updateOtherLegalOfficer(It.Is<ValidAccountId>(value => value.equals(CHARLY_ACCOUNT))))
        repository.verify(instance => instance.save(protectionRequest.object()));
    });

    it('fails to update when auth fails', async () => {
        const mock = mockAuthenticationWithCondition(false);
        const app = setupApp(ProtectionRequestController, container => mockModelForUserUpdate(container, protectionRequest, repository), mock);

        await request(app)
            .put('/api/protection-request/' + REQUEST_ID + "/update")
            .send({
                otherLegalOfficerAddress: CHARLY
            })
            .expect(401);
        protectionRequest.verify(instance => instance.updateOtherLegalOfficer(It.IsAny<ValidAccountId>()), Times.Never())
    });

})

function mockDecision(protectionRequest: Mock<ProtectionRequestAggregateRoot>, decisionDescription: LegalOfficerDecisionDescription | undefined) {
    const decision = new Mock<LegalOfficerDecision>();
    if (decisionDescription) {
        decision.setup(instance => instance.rejectReason)
            .returns(decisionDescription.rejectReason)
        decision.setup(instance => instance.decisionOn)
            .returns(decisionDescription.decisionOn)
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
    mockNotificationAndDirectoryService(container);

    container.bind(ProtectionRequestService).toConstantValue(new NonTransactionalProtectionRequestService(repository.object()));
    container.bind(LocRequestAdapter).toConstantValue(mockLocRequestAdapter());
    container.bind(LocRequestRepository).toConstantValue(mockLocRequestRepository());
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
        .returns(Promise.resolve(notifiedLegalOfficer(ALICE_ACCOUNT.address)))
    directoryService
        .setup(instance => instance.requireLegalOfficerAddressOnNode(It.IsAny<string>()))
        .returns(Promise.resolve(ALICE_ACCOUNT));
    container.bind(DirectoryService).toConstantValue(directoryService.object())
}

function mockProtectionRequest(): Mock<ProtectionRequestAggregateRoot> {

    const identityLoc = mockIdentityLoc();
    const description: ProtectionRequestDescription = {
        requesterAddress: REQUESTER,
        requesterIdentityLocId: identityLoc.id!,
        legalOfficerAddress: ALICE_ACCOUNT,
        isRecovery: false,
        otherLegalOfficerAddress: BOB_ACCOUNT,
        createdOn: moment.now().toString(),
        addressToRecover: null,
    }
    const protectionRequest = new Mock<ProtectionRequestAggregateRoot>()
    protectionRequest.setup(instance => instance.id).returns(REQUEST_ID)
    protectionRequest.setup(instance => instance.requesterAddress).returns(description.requesterAddress.getAddress(DB_SS58_PREFIX))
    protectionRequest.setup(instance => instance.requesterIdentityLocId).returns(description.requesterIdentityLocId)
    protectionRequest.setup(instance => instance.isRecovery).returns(description.isRecovery)
    protectionRequest.setup(instance => instance.otherLegalOfficerAddress).returns(description.otherLegalOfficerAddress.getAddress(DB_SS58_PREFIX))
    protectionRequest.setup(instance => instance.getDescription()).returns(description)
    protectionRequest.setup(instance => instance.getLegalOfficer()).returns(ALICE_ACCOUNT)
    protectionRequest.setup(instance => instance.getOtherLegalOfficer()).returns(BOB_ACCOUNT)
    protectionRequest.setup(instance => instance.getRequester()).returns(REQUESTER)
    protectionRequest.setup(instance => instance.getAddressToRecover()).returns(null)
    return protectionRequest
}

function mockModelForUserResubmit(container: Container, protectionRequest: Mock<ProtectionRequestAggregateRoot>, repository: Mock<ProtectionRequestRepository>): void {
    mockModelForUser(container, protectionRequest, repository);
    protectionRequest.setup(instance => instance.resubmit())
        .returns(undefined);
}

function mockModelForUserCancel(container: Container, protectionRequest: Mock<ProtectionRequestAggregateRoot>, repository: Mock<ProtectionRequestRepository>): void {
    mockModelForUser(container, protectionRequest, repository);
    protectionRequest.setup(instance => instance.cancel())
        .returns(undefined);
}

function mockModelForUserUpdate(container: Container, protectionRequest: Mock<ProtectionRequestAggregateRoot>, repository: Mock<ProtectionRequestRepository>): void {
    mockModelForUser(container, protectionRequest, repository);
    protectionRequest.setup(instance => instance.updateOtherLegalOfficer(It.Is<ValidAccountId>(value => value.equals(CHARLY_ACCOUNT))))
        .returns(undefined);
}

function mockModelForUser(container: Container, protectionRequest: Mock<ProtectionRequestAggregateRoot>, repository: Mock<ProtectionRequestRepository>) {

    repository.setup(instance => instance.findById(REQUEST_ID))
        .returns(Promise.resolve(protectionRequest.object()));
    repository.setup(instance => instance.save(protectionRequest.object()))
        .returns(Promise.resolve());
    container.bind(ProtectionRequestRepository).toConstantValue(repository.object());

    const factory = new Mock<ProtectionRequestFactory>();
    container.bind(ProtectionRequestFactory).toConstantValue(factory.object());
    mockNotificationAndDirectoryService(container);

    container.bind(ProtectionRequestService).toConstantValue(new NonTransactionalProtectionRequestService(repository.object()));
    container.bind(LocRequestAdapter).toConstantValue(mockLocRequestAdapter());
    container.bind(LocRequestRepository).toConstantValue(mockLocRequestRepository());
}
