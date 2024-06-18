import { Container } from 'inversify';
import { Mock, It, Times } from 'moq.ts';
import request from 'supertest';

import { TestApp } from '@logion/rest-api-core';

import {
    AccountRecoveryRepository,
    AccountRecoveryRequestFactory,
    AccountRecoveryRequestAggregateRoot,
    NewAccountRecoveryRequestParameters,
    AccountRecoveryRequestDescription,
} from '../../../src/logion/model/account_recovery.model.js';
import { ALICE, BOB, BOB_ACCOUNT, ALICE_ACCOUNT } from '../../helpers/addresses.js';
import { AccountRecoveryController } from '../../../src/logion/controllers/account_recovery.controller.js';
import { NotificationService, Template } from "../../../src/logion/services/notification.service.js";
import moment from "moment";
import { LegalOfficerService } from "../../../src/logion/services/legalOfficerService.js";
import { notifiedLegalOfficer } from "../services/notification-test-data.js";
import { UserIdentity } from '../../../src/logion/model/useridentity.js';
import { PostalAddress } from '../../../src/logion/model/postaladdress.js';
import { NonTransactionalAccountRecoveryRequestService, AccountRecoveryRequestService } from '../../../src/logion/services/accountrecoveryrequest.service.js';
import { LocRequestAggregateRoot, LocRequestRepository } from "../../../src/logion/model/locrequest.model.js";
import { LocRequestAdapter } from "../../../src/logion/controllers/adapters/locrequestadapter.js";
import { ValidAccountId } from "@logion/node-api";
import { DB_SS58_PREFIX, EmbeddableNullableAccountId } from "../../../src/logion/model/supportedaccountid.model.js";
import { LocRequestDescription } from 'src/logion/model/loc_vos.js';
import { LegalOfficerDecision, LegalOfficerDecisionDescription } from 'src/logion/model/decision.js';

const DECISION_TIMESTAMP = "2021-06-10T16:25:23.668294";
const { mockAuthenticationWithCondition, setupApp, mockLegalOfficerOnNode, mockAuthenticationWithAuthenticatedUser, mockAuthenticatedUser } = TestApp;

describe('Account Recovery request creation', () => {

    it('success with valid recovery request', async () => {
        const app = setupApp(
            AccountRecoveryController,
            container => mockModelForRecovery(container, ACCOUNT_TO_RECOVER.address),
            mockAuthenticationWithAuthenticatedUser(mockAuthenticatedUser(true, REQUESTER))
        );

        await request(app)
            .post('/api/account-recovery')
            .send({
                requesterIdentityLoc: REQUESTER_IDENTITY_LOC_ID,
                legalOfficerAddress: ALICE,
                otherLegalOfficerAddress: BOB,
                isRecovery: true,
                addressToRecover: ACCOUNT_TO_RECOVER.address,
            })
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.id).toBeDefined();
            });
    });

    it('failure with empty request', async () => {
        const app = setupApp(AccountRecoveryController, container => mockModelForRecovery(container, ACCOUNT_TO_RECOVER.address));

        await request(app)
            .post('/api/account-recovery')
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

const ACCOUNT_TO_RECOVER = ValidAccountId.polkadot("vQvrwS6w8eXorsbsH4cp6YdNtEegZYH9CvhHZizV2p9dPGyDJ");

function mockRecoveryRequestModel(container: Container, addressToRecover: ValidAccountId): void {
    const repository = new Mock<AccountRecoveryRepository>();
    repository.setup(instance => instance.save)
        .returns(() => Promise.resolve());
    container.bind(AccountRecoveryRepository).toConstantValue(repository.object());

    const factory = new Mock<AccountRecoveryRequestFactory>();
    const root = mockRecoveryRequest()
    mockDecision(root, undefined)
    const identityLoc = mockIdentityLoc(REQUESTER);
    root.setup(instance => instance.requesterIdentityLocId)
        .returns(identityLoc.id)


    factory.setup(instance => instance.newAccountRecoveryRequest(
        It.Is<NewAccountRecoveryRequestParameters>(params => {
            return params.addressToRecover !== null
                && params.addressToRecover.equals(addressToRecover)
                && params.requesterAddress.equals(REQUESTER)
        })))
        .returns(Promise.resolve(root.object()));
    container.bind(AccountRecoveryRequestFactory).toConstantValue(factory.object());
    mockNotificationAndLegalOfficerService(container);

    container.bind(AccountRecoveryRequestService).toConstantValue(new NonTransactionalAccountRecoveryRequestService(repository.object()));
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

function mockIdentityLoc(requester: ValidAccountId): LocRequestAggregateRoot {
    const identityLoc = new Mock<LocRequestAggregateRoot>();
    const description = {
        userIdentity: IDENTITY,
        userPostalAddress: POSTAL_ADDRESS,
    };
    identityLoc.setup(instance => instance.id)
        .returns(REQUESTER_IDENTITY_LOC_ID);
    identityLoc.setup(instance => instance.requester).returns(EmbeddableNullableAccountId.from(requester));
    identityLoc.setup(instance => instance.getRequester()).returns(requester);
    identityLoc.setup(instance => instance.getDescription())
        .returns(description as LocRequestDescription);
    return identityLoc.object();
}

function mockModelForRecovery(container: Container, addressToRecover: string): void {
    mockRecoveryRequestModel(container, ValidAccountId.polkadot(addressToRecover));
}

describe('Account Recovery request fetch', () => {

    it('returns expected response', async () => {
        const app = setupApp(AccountRecoveryController, mockModelForFetch);

        await request(app)
            .put('/api/account-recovery')
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
                expect(response.body.requests[0].status).toBe("REJECTED");
            });
    });

    it('fails on authentication failure', async  () => {
        const mock = mockAuthenticationWithCondition(false);
        const app = setupApp(AccountRecoveryController, mockModelForFetch, mock);

        await request(app)
            .put('/api/account-recovery')
            .send({
                requesterAddress: REQUESTER.address,
                legalOfficerAddress: ALICE,
                decisionStatuses: ["ACCEPTED", "REJECTED"]
            })
            .expect(401);

    });

    it("fetches recovery information", async () => {
        const userMock = mockAuthenticationWithAuthenticatedUser(mockLegalOfficerOnNode(ALICE_ACCOUNT));
        const app = setupApp(AccountRecoveryController, mockModelForReview, userMock);
        await request(app)
            .put(`/api/account-recovery/${ REQUEST_ID }/recovery-info`)
            .expect(200)
            .then(response => {
                expect(response.body.identity1).toBeDefined();
                expect(response.body.identity1.userIdentity).toEqual(IDENTITY);
                expect(response.body.identity1.userPostalAddress).toEqual(POSTAL_ADDRESS);

                expect(response.body.identity2).toBeDefined();
                expect(response.body.identity2.userIdentity).toEqual(IDENTITY);
                expect(response.body.identity2.userPostalAddress).toEqual(POSTAL_ADDRESS);

                expect(response.body.type).toBe("ACCOUNT");

                expect(response.body.accountRecovery).toBeDefined();
                expect(response.body.accountRecovery.address1).toBe(ACCOUNT_TO_RECOVER.address);
                expect(response.body.accountRecovery.address2).toBe(REQUESTER.address);
            });
    });
});

const REQUESTER = ValidAccountId.polkadot("5H4MvAsobfZ6bBCDyj5dsrWYLrA8HrRzaqa9p61UXtxMhSCY");
const REQUESTER_IDENTITY_LOC_ID = "77c2fef4-6f1d-44a1-a49d-3485c2eb06ee";
const TIMESTAMP = "2021-06-10T16:25:23.668294";
const REJECT_REASON = "Illegal";

function mockModelForFetch(container: Container): void {
    const repository = new Mock<AccountRecoveryRepository>();

    const recoveryRequest = mockRecoveryRequest()

    mockDecision(recoveryRequest, {
        rejectReason: REJECT_REASON,
        decisionOn: DECISION_TIMESTAMP
    })

    recoveryRequest.setup(instance => instance.legalOfficerAddress).returns(ALICE_ACCOUNT.getAddress(DB_SS58_PREFIX));
    recoveryRequest.setup(instance => instance.createdOn).returns(TIMESTAMP);
    recoveryRequest.setup(instance => instance.addressToRecover).returns(null);
    recoveryRequest.setup(instance => instance.status).returns('REJECTED');
    const identityLoc = mockIdentityLoc(REQUESTER);
    recoveryRequest.setup(instance => instance.requesterIdentityLocId).returns(identityLoc.id);

    const requests: AccountRecoveryRequestAggregateRoot[] = [ recoveryRequest.object() ];
    repository.setup(instance => instance.findBy)
        .returns(() => Promise.resolve(requests));
    repository.setup(instance => instance.findById)
        .returns(() => Promise.resolve(recoveryRequest.object()));
    container.bind(AccountRecoveryRepository).toConstantValue(repository.object());

    const factory = new Mock<AccountRecoveryRequestFactory>();
    container.bind(AccountRecoveryRequestFactory).toConstantValue(factory.object());
    mockNotificationAndLegalOfficerService(container)

    container.bind(AccountRecoveryRequestService).toConstantValue(new NonTransactionalAccountRecoveryRequestService(repository.object()));
    container.bind(LocRequestAdapter).toConstantValue(mockLocRequestAdapter());
    container.bind(LocRequestRepository).toConstantValue(mockLocRequestRepository());
}

function mockModelForReview(container: Container): void {
    const repository = new Mock<AccountRecoveryRepository>();

    const recoveryRequest = mockRecoveryRequest()
    recoveryRequest.setup(instance => instance.legalOfficerAddress).returns(ALICE_ACCOUNT.getAddress(DB_SS58_PREFIX));
    recoveryRequest.setup(instance => instance.createdOn).returns(TIMESTAMP);
    recoveryRequest.setup(instance => instance.addressToRecover).returns(ACCOUNT_TO_RECOVER.address);
    recoveryRequest.setup(instance => instance.getAddressToRecover()).returns(ACCOUNT_TO_RECOVER);
    recoveryRequest.setup(instance => instance.status).returns('PENDING');
    const identityLoc = mockIdentityLoc(ACCOUNT_TO_RECOVER);
    recoveryRequest.setup(instance => instance.requesterIdentityLocId).returns(identityLoc.id);
    recoveryRequest.setup(instance => instance.getDescription()).returns({
        addressToRecover: ACCOUNT_TO_RECOVER,
        createdOn: moment().toISOString(),
        id: REQUEST_ID,
        legalOfficerAddress: ALICE_ACCOUNT,
        otherLegalOfficerAddress: BOB_ACCOUNT,
        requesterAddress: REQUESTER,
        requesterIdentityLocId: identityLoc.id!,
        status: 'PENDING',
    });

    repository.setup(instance => instance.findById)
        .returns(() => Promise.resolve(recoveryRequest.object()));
    container.bind(AccountRecoveryRepository).toConstantValue(repository.object());

    const factory = new Mock<AccountRecoveryRequestFactory>();
    container.bind(AccountRecoveryRequestFactory).toConstantValue(factory.object());
    mockNotificationAndLegalOfficerService(container)

    container.bind(AccountRecoveryRequestService).toConstantValue(new NonTransactionalAccountRecoveryRequestService(repository.object()));
    container.bind(LocRequestAdapter).toConstantValue(mockLocRequestAdapter());

    const locRequestRepository = new Mock<LocRequestRepository>();
    locRequestRepository.setup(instance => instance.getValidPolkadotIdentityLoc(ACCOUNT_TO_RECOVER, ALICE_ACCOUNT))
        .returns(Promise.resolve(identityLoc));
    container.bind(LocRequestRepository).toConstantValue(locRequestRepository.object());
}

function authenticatedLLONotProtectingUser() {
    const authenticatedUser = mockLegalOfficerOnNode(BOB_ACCOUNT);
    return mockAuthenticationWithAuthenticatedUser(authenticatedUser);
}

describe('Account Recovery Request accept', () => {

    it('protecting LLO accepts', async () => {
        const app = setupApp(AccountRecoveryController, container => mockModelForAccept(container, true));

        await request(app)
            .post('/api/account-recovery/' + REQUEST_ID + "/accept")
            .send({
                locId: "locId"
            })
            .expect(200)
            .expect('Content-Type', /application\/json/);

        notificationService.verify(instance => instance.notify(IDENTITY.email, "recovery-accepted", It.Is<any>(data => {
            return data.recovery.decision.decisionOn === DECISION_TIMESTAMP;
        })))
    });

    it('non-protecting LLO fails to accept', async () => {
        const app = setupApp(AccountRecoveryController, container => mockModelForAccept(container, true), authenticatedLLONotProtectingUser());

        await request(app)
            .post('/api/account-recovery/' + REQUEST_ID + "/accept")
            .send({
                locId: "locId"
            })
            .expect(401)

        notificationService.verify(instance => instance.notify, Times.Never());
    });
});

let notificationService: Mock<NotificationService>;

function mockModelForAccept(container: Container, verifies: boolean): void {
    const recoveryRequest = mockRecoveryRequest();
    recoveryRequest.setup(instance => instance.accept(It.IsAny()))
        .returns(undefined);

    mockDecision(recoveryRequest, { decisionOn: DECISION_TIMESTAMP} )

    const repository = new Mock<AccountRecoveryRepository>();
    repository.setup(instance => instance.findById(REQUEST_ID))
        .returns(Promise.resolve(recoveryRequest.object()));
    if(verifies) {
        repository.setup(instance => instance.save)
            .returns(() => Promise.resolve());
    }
    container.bind(AccountRecoveryRepository).toConstantValue(repository.object());

    const factory = new Mock<AccountRecoveryRequestFactory>();
    container.bind(AccountRecoveryRequestFactory).toConstantValue(factory.object());
    mockNotificationAndLegalOfficerService(container);

    container.bind(AccountRecoveryRequestService).toConstantValue(new NonTransactionalAccountRecoveryRequestService(repository.object()));
    container.bind(LocRequestAdapter).toConstantValue(mockLocRequestAdapter());
    container.bind(LocRequestRepository).toConstantValue(mockLocRequestRepository());
}

const REQUEST_ID = "requestId";

describe('Account Recovery Request reject', () => {

    it('protecting LLO rejects', async () => {
        const app = setupApp(AccountRecoveryController, container => mockModelForReject(container, true));

        await request(app)
            .post('/api/account-recovery/' + REQUEST_ID + "/reject")
            .send({
                legalOfficerAddress: ALICE,
                rejectReason: REJECT_REASON,
            })
            .expect(200)
            .expect('Content-Type', /application\/json/);

        notificationService.verify(instance => instance.notify(IDENTITY.email, "recovery-rejected", It.Is<any>(data => {
            return data.recovery.decision.rejectReason === REJECT_REASON &&
                data.recovery.decision.decisionOn === DECISION_TIMESTAMP
        })))
    });

    it('non-protecting LLO fails to reject', async () => {
        const app = setupApp(AccountRecoveryController, container => mockModelForReject(container, true), authenticatedLLONotProtectingUser());

        await request(app)
            .post('/api/account-recovery/' + REQUEST_ID + "/reject")
            .send({
                legalOfficerAddress: ALICE,
                rejectReason: REJECT_REASON,
            })
            .expect(401);

        notificationService.verify(instance => instance.notify, Times.Never());
    });
});

describe('Account Recovery user', () => {

    let recoveryRequest: Mock<AccountRecoveryRequestAggregateRoot>;
    let repository = new Mock<AccountRecoveryRepository>();


    beforeEach(() => {
        recoveryRequest = mockRecoveryRequest();
        repository = new Mock<AccountRecoveryRepository>();
    })

    it('cancels', async () => {
        const app = setupApp(AccountRecoveryController, container => mockModelForUserCancel(container, recoveryRequest, repository));

        await request(app)
            .post('/api/account-recovery/' + REQUEST_ID + "/cancel")
            .send()
            .expect(204);

        notificationService.verify(instance => instance.notify("alice@logion.network", "recovery-cancelled", It.IsAny<any>()))
        recoveryRequest.verify(instance => instance.cancel())
        repository.verify(instance => instance.save(recoveryRequest.object()));
    });

    it('fails to cancel when auth fails', async () => {
        const mock = mockAuthenticationWithCondition(false);
        const app = setupApp(AccountRecoveryController, container => mockModelForUserCancel(container, recoveryRequest, repository), mock);

        await request(app)
            .post('/api/account-recovery/' + REQUEST_ID + "/cancel")
            .send()
            .expect(401);
        recoveryRequest.verify(instance => instance.cancel(), Times.Never())
    });

})

function mockDecision(request: Mock<AccountRecoveryRequestAggregateRoot>, decisionDescription: LegalOfficerDecisionDescription | undefined) {
    const decision = new Mock<LegalOfficerDecision>();
    if (decisionDescription) {
        decision.setup(instance => instance.rejectReason)
            .returns(decisionDescription.rejectReason)
        decision.setup(instance => instance.decisionOn)
            .returns(decisionDescription.decisionOn)
    }
    request.setup(instance => instance.decision)
        .returns(decision.object());
    request.setup(instance => instance.getDecision())
        .returns(decisionDescription)
}

function mockModelForReject(container: Container, verifies: boolean): void {
    const recoveryRequest = mockRecoveryRequest();
    recoveryRequest.setup(instance => instance.reject).returns(() => {});

    mockDecision(recoveryRequest, {
        rejectReason: REJECT_REASON,
        decisionOn: DECISION_TIMESTAMP
    })

    const repository = new Mock<AccountRecoveryRepository>();
    repository.setup(instance => instance.findById(REQUEST_ID))
        .returns(Promise.resolve(recoveryRequest.object()));
    if(verifies) {
        repository.setup(instance => instance.save)
            .returns(() => Promise.resolve());
    }
    container.bind(AccountRecoveryRepository).toConstantValue(repository.object());

    const factory = new Mock<AccountRecoveryRequestFactory>();
    container.bind(AccountRecoveryRequestFactory).toConstantValue(factory.object());
    mockNotificationAndLegalOfficerService(container);

    container.bind(AccountRecoveryRequestService).toConstantValue(new NonTransactionalAccountRecoveryRequestService(repository.object()));
    container.bind(LocRequestAdapter).toConstantValue(mockLocRequestAdapter());
    container.bind(LocRequestRepository).toConstantValue(mockLocRequestRepository());
}

function mockNotificationAndLegalOfficerService(container: Container) {
    notificationService = new Mock<NotificationService>();
    notificationService
        .setup(instance => instance.notify(It.IsAny<string>(), It.IsAny<Template>(), It.IsAny<any>()))
        .returns(Promise.resolve())
    container.bind(NotificationService).toConstantValue(notificationService.object())

    const legalOfficerService = new Mock<LegalOfficerService>();
    legalOfficerService
        .setup(instance => instance.get(It.IsAny<string>()))
        .returns(Promise.resolve(notifiedLegalOfficer(ALICE_ACCOUNT.address)))
    legalOfficerService
        .setup(instance => instance.requireLegalOfficerAddressOnNode(It.IsAny<string>()))
        .returns(Promise.resolve(ALICE_ACCOUNT));
    container.bind(LegalOfficerService).toConstantValue(legalOfficerService.object())
}

function mockRecoveryRequest(): Mock<AccountRecoveryRequestAggregateRoot> {

    const identityLoc = mockIdentityLoc(REQUESTER);
    const description: AccountRecoveryRequestDescription = {
        id: "a7ff4ab6-5bef-4310-9c28-bcbd653565c3",
        status: "ACCEPTED",
        requesterAddress: REQUESTER,
        requesterIdentityLocId: identityLoc.id!,
        legalOfficerAddress: ALICE_ACCOUNT,
        otherLegalOfficerAddress: BOB_ACCOUNT,
        createdOn: moment.now().toString(),
        addressToRecover: ACCOUNT_TO_RECOVER,
    }
    const request = new Mock<AccountRecoveryRequestAggregateRoot>()
    request.setup(instance => instance.id).returns(REQUEST_ID)
    request.setup(instance => instance.requesterAddress).returns(description.requesterAddress.getAddress(DB_SS58_PREFIX))
    request.setup(instance => instance.requesterIdentityLocId).returns(description.requesterIdentityLocId)
    request.setup(instance => instance.otherLegalOfficerAddress).returns(description.otherLegalOfficerAddress.getAddress(DB_SS58_PREFIX))
    request.setup(instance => instance.getDescription()).returns(description)
    request.setup(instance => instance.getLegalOfficer()).returns(ALICE_ACCOUNT)
    request.setup(instance => instance.getOtherLegalOfficer()).returns(BOB_ACCOUNT)
    request.setup(instance => instance.getRequester()).returns(REQUESTER)
    request.setup(instance => instance.getAddressToRecover()).returns(ACCOUNT_TO_RECOVER)
    return request
}

function mockModelForUserCancel(container: Container, request: Mock<AccountRecoveryRequestAggregateRoot>, repository: Mock<AccountRecoveryRepository>): void {
    mockModelForUser(container, request, repository);
    request.setup(instance => instance.cancel())
        .returns(undefined);
}

function mockModelForUser(container: Container, request: Mock<AccountRecoveryRequestAggregateRoot>, repository: Mock<AccountRecoveryRepository>) {

    repository.setup(instance => instance.findById(REQUEST_ID))
        .returns(Promise.resolve(request.object()));
    repository.setup(instance => instance.save(request.object()))
        .returns(Promise.resolve());
    container.bind(AccountRecoveryRepository).toConstantValue(repository.object());

    const factory = new Mock<AccountRecoveryRequestFactory>();
    container.bind(AccountRecoveryRequestFactory).toConstantValue(factory.object());
    mockNotificationAndLegalOfficerService(container);

    container.bind(AccountRecoveryRequestService).toConstantValue(new NonTransactionalAccountRecoveryRequestService(repository.object()));
    container.bind(LocRequestAdapter).toConstantValue(mockLocRequestAdapter());
    container.bind(LocRequestRepository).toConstantValue(mockLocRequestRepository());
}
