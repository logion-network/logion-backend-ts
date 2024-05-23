import { Container } from 'inversify';
import { Mock } from 'moq.ts';
import request from 'supertest';

import { TestApp } from '@logion/rest-api-core';

import {
    ProtectionRequestRepository,
    ProtectionRequestAggregateRoot,
    ProtectionRequestDescription,
} from '../../../src/logion/model/protectionrequest.model.js';
import { BOB_ACCOUNT, ALICE_ACCOUNT } from '../../helpers/addresses.js';
import { UserIdentity } from '../../../src/logion/model/useridentity.js';
import { PostalAddress } from '../../../src/logion/model/postaladdress.js';
import { LocRequestAdapter } from "../../../src/logion/controllers/adapters/locrequestadapter.js";
import { ValidAccountId } from "@logion/node-api";
import { RecoveryController } from '../../../src/logion/controllers/recovery.controller.js';
import { SecretRecoveryRequestAggregateRoot, SecretRecoveryRequestDescription, SecretRecoveryRequestRepository } from '../../../src/logion/model/secret_recovery.model.js';
import { ItIsAccount } from '../../helpers/Mock.js';
import moment from 'moment';

const { setupApp, mockLegalOfficerOnNode, mockAuthenticationWithAuthenticatedUser } = TestApp;

describe('RecoveryController', () => {

    it('fetchRecoveryRequests', async () => {
        const userMock = mockAuthenticationWithAuthenticatedUser(mockLegalOfficerOnNode(ALICE_ACCOUNT));
        const app = setupApp(RecoveryController, mockModelForFetch, userMock);

        await request(app)
            .put('/api/recovery-requests')
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.requests).toBeDefined();
                expect(response.body.requests.length).toBe(2);

                expect(response.body.requests[0].userIdentity).toEqual(IDENTITY);
                expect(response.body.requests[0].userPostalAddress).toEqual(POSTAL_ADDRESS);
                expect(response.body.requests[0].createdOn).toBe(ACCOUNT_CREATED_ON);
                expect(response.body.requests[0].status).toBe("ACCEPTED");
                expect(response.body.requests[0].id).toBe(ACCOUNT_RECOVERY_REQUEST_ID);
                expect(response.body.requests[0].type).toBe("ACCOUNT");

                expect(response.body.requests[1].userIdentity).toEqual(IDENTITY);
                expect(response.body.requests[1].userPostalAddress).toEqual(POSTAL_ADDRESS);
                expect(response.body.requests[1].createdOn).toBe(SECRET_CREATED_ON.toISOString());
                expect(response.body.requests[1].status).toBe("REJECTED");
                expect(response.body.requests[1].id).toBe(SECRET_RECOVERY_REQUEST_ID);
                expect(response.body.requests[1].type).toBe("SECRET");
                expect(response.body.requests[1].rejectReason).toBe(REJECT_REASON);
            });
    });
});

function mockModelForFetch(container: Container): void {
    const accountRecoveryRequestRepository = new Mock<ProtectionRequestRepository>();

    const protectionRequest = mockProtectionRequest();

    const requests: ProtectionRequestAggregateRoot[] = [ protectionRequest.object() ];
    accountRecoveryRequestRepository.setup(instance => instance.findBy)
        .returns(() => Promise.resolve(requests));
    container.bind(ProtectionRequestRepository).toConstantValue(accountRecoveryRequestRepository.object());

    container.bind(LocRequestAdapter).toConstantValue(mockLocRequestAdapter());

    const secretRecoveryRequest = mockSecretRecoveryRequest();
    const secretRecoveryRequestRepository = new Mock<SecretRecoveryRequestRepository>();
    secretRecoveryRequestRepository.setup(instance => instance.findByLegalOfficer(ItIsAccount(ALICE_ACCOUNT)))
        .returns(Promise.resolve([ secretRecoveryRequest.object() ]));
    container.bind(SecretRecoveryRequestRepository).toConstantValue(secretRecoveryRequestRepository.object());
}

function mockProtectionRequest(): Mock<ProtectionRequestAggregateRoot> {
    const description: ProtectionRequestDescription = {
        id: ACCOUNT_RECOVERY_REQUEST_ID,
        status: "ACCEPTED",
        requesterAddress: REQUESTER,
        requesterIdentityLocId: REQUESTER_IDENTITY_LOC_ID,
        legalOfficerAddress: ALICE_ACCOUNT,
        isRecovery: false,
        otherLegalOfficerAddress: BOB_ACCOUNT,
        createdOn: ACCOUNT_CREATED_ON,
        addressToRecover: null,
    }
    const protectionRequest = new Mock<ProtectionRequestAggregateRoot>();
    protectionRequest.setup(instance => instance.getDescription()).returns(description);
    protectionRequest.setup(instance => instance.getLegalOfficer()).returns(ALICE_ACCOUNT);
    protectionRequest.setup(instance => instance.getOtherLegalOfficer()).returns(BOB_ACCOUNT);
    protectionRequest.setup(instance => instance.getRequester()).returns(REQUESTER);
    protectionRequest.setup(instance => instance.getAddressToRecover()).returns(null);
    protectionRequest.setup(instance => instance.getDecision()).returns(undefined);
    return protectionRequest;
}

const REQUESTER = ValidAccountId.polkadot("5H4MvAsobfZ6bBCDyj5dsrWYLrA8HrRzaqa9p61UXtxMhSCY");

const ACCOUNT_CREATED_ON = "2021-06-10T16:25:23.668294";

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

const REQUESTER_IDENTITY_LOC_ID = "77c2fef4-6f1d-44a1-a49d-3485c2eb06ee";

const ACCOUNT_RECOVERY_REQUEST_ID = "a7ff4ab6-5bef-4310-9c28-bcbd653565c3";

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

function mockSecretRecoveryRequest(): Mock<SecretRecoveryRequestAggregateRoot> {
    const description: SecretRecoveryRequestDescription = {
        id: SECRET_RECOVERY_REQUEST_ID,
        status: "REJECTED",
        requesterIdentityLocId: REQUESTER_IDENTITY_LOC_ID,
        createdOn: SECRET_CREATED_ON,
        challenge: "Challenge",
        secretName: "Key",
        userIdentity: IDENTITY,
        userPostalAddress: POSTAL_ADDRESS,
    }
    const protectionRequest = new Mock<SecretRecoveryRequestAggregateRoot>();
    protectionRequest.setup(instance => instance.getDescription()).returns(description);
    protectionRequest.setup(instance => instance.getDecision()).returns({
        decisionOn: DECISION_ON.toISOString(),
        rejectReason: REJECT_REASON,
    });
    return protectionRequest;
}

const SECRET_RECOVERY_REQUEST_ID = "f293127e-8356-47a7-a6b7-480cdd1daabd";
const SECRET_CREATED_ON = moment();
const DECISION_ON = moment();
const REJECT_REASON = "Because.";
