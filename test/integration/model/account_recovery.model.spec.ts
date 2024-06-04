import { TestDb } from "@logion/rest-api-core";
import { EmbeddablePostalAddress } from "../../../src/logion/model/postaladdress.js";
import { EmbeddableUserIdentity } from "../../../src/logion/model/useridentity.js";
import {
    FetchAccountRecoveryRequestsSpecification,
    AccountRecoveryRequestAggregateRoot,
    AccountRecoveryRepository,
    AccountRecoveryRequestStatus,
} from "../../../src/logion/model/account_recovery.model.js";
import { ALICE_ACCOUNT, BOB_ACCOUNT } from "../../helpers/addresses.js";
import { LocRequestAggregateRoot } from "../../../src/logion/model/locrequest.model.js";
import { ValidAccountId } from "@logion/node-api";
import { EmbeddableNullableAccountId, DB_SS58_PREFIX } from "../../../src/logion/model/supportedaccountid.model.js";

const { connect, disconnect, checkNumOfRows, executeScript } = TestDb;

describe('AccountRecoveryRepository (read)', () => {

    beforeAll(async () => {
        await connect([ AccountRecoveryRequestAggregateRoot ]);
        await executeScript("test/integration/model/account_recovery.sql");
        repository = new AccountRecoveryRepository();
    });

    let repository: AccountRecoveryRepository;

    afterAll(async () => {
        await disconnect();
    });

    it("findByDecision", async () => {
        const specification = new FetchAccountRecoveryRequestsSpecification({
            expectedStatuses: [ 'ACCEPTED', 'REJECTED'],
        });

        const results = await repository.findBy(specification);

        expect(results.length).toBe(3);
        expectAcceptedOrRejected(results);
    });

    it("findByRequesterAddressOnly", async () => {
        let requesterAddress = ValidAccountId.polkadot("5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW");
        const specification = new FetchAccountRecoveryRequestsSpecification({
            expectedRequesterAddress: requesterAddress
        });

        const results = await repository.findBy(specification);

        expect(results.length).toBe(1);
    });

    it("findActivatedOnly", async () => {
        const specification = new FetchAccountRecoveryRequestsSpecification({
            expectedStatuses: [ 'ACTIVATED' ]
        });

        const results = await repository.findBy(specification);

        expect(results.length).toBe(1);
        expectStatus(results, 'ACTIVATED');
    });

    it("findPendingOnly", async () => {
        const specification = new FetchAccountRecoveryRequestsSpecification({
            expectedStatuses: [ 'PENDING' ],
        });

        const results = await repository.findBy(specification);

        expect(results.length).toBe(1);
        expectStatus(results, 'PENDING');
    });

    it("finds workload", async () => {
        const specification = new FetchAccountRecoveryRequestsSpecification({
            expectedLegalOfficerAddress: [ ALICE_ACCOUNT, BOB_ACCOUNT ],
            expectedStatuses: [ "PENDING" ],
        });
        const results = await repository.findBy(specification);
        expect(results.length).toBe(1);
        expectStatus(results, 'PENDING');
    });
});

describe('AccountRecoveryRepository (write)', () => {

    beforeAll(async () => {
        await connect([ AccountRecoveryRequestAggregateRoot ]);
        repository = new AccountRecoveryRepository();
    });

    let repository: AccountRecoveryRepository;

    afterAll(async () => {
        await disconnect();
    });

    it("saves protection request", async () => {
        // Given
        const identityLoc = new LocRequestAggregateRoot();
        identityLoc.id = "80124e8a-a7d8-456f-a7be-deb4e0983e87";
        identityLoc.status = "CLOSED"
        identityLoc.requester = EmbeddableNullableAccountId.from(ValidAccountId.polkadot('5HQqkmkt6KqxQACPQ2uvH4mHrXouTSbtyT9XWJj8TUaaCE7q'))
        identityLoc.ownerAddress = BOB_ACCOUNT.getAddress(DB_SS58_PREFIX)
        identityLoc.userIdentity = new EmbeddableUserIdentity()
        identityLoc.userIdentity.email = 'john.doe@logion.network'
        identityLoc.userIdentity.phoneNumber = '+1234897'
        identityLoc.userIdentity.firstName = 'John'
        identityLoc.userIdentity.lastName = 'Doe'
        identityLoc.userPostalAddress = new EmbeddablePostalAddress()
        identityLoc.userPostalAddress.line1 = '15 Rue du Bois'
        identityLoc.userPostalAddress.postalCode = '75000'
        identityLoc.userPostalAddress.city = 'Paris'
        identityLoc.userPostalAddress.country = 'France'

        const protectionRequest = new AccountRecoveryRequestAggregateRoot()
        protectionRequest.id = '9a7df79e-9d3a-4ef8-b4e1-496bbe30a639'
        protectionRequest.requesterAddress = identityLoc.getRequester()?.getAddress(DB_SS58_PREFIX);
        protectionRequest.requesterIdentityLocId = identityLoc.id;

        protectionRequest.status = 'PENDING'
        protectionRequest.legalOfficerAddress = BOB_ACCOUNT.getAddress(DB_SS58_PREFIX);
        protectionRequest.otherLegalOfficerAddress = ALICE_ACCOUNT.getAddress(DB_SS58_PREFIX);
        // When
        await repository.save(protectionRequest)
        // Then
        await checkNumOfRows(`SELECT *
                              FROM account_recovery_request
                              WHERE id = '${ protectionRequest.id }'`, 1)
    })
});

function expectAcceptedOrRejected(results: AccountRecoveryRequestAggregateRoot[]) {
    results.forEach(request => expect(request.status).toMatch(/ACCEPTED|REJECTED/));
}

function expectAcceptedRejectedActivated(results: AccountRecoveryRequestAggregateRoot[]) {
    results.forEach(request => expect(request.status).toMatch(/ACCEPTED|REJECTED|ACTIVATED/));
}

function expectStatus(results: AccountRecoveryRequestAggregateRoot[], status: AccountRecoveryRequestStatus) {
    results.forEach(request => {
        expect(request.status!).toBe(status);
    });
}
