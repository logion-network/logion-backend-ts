import { TestDb } from "@logion/rest-api-core";
import {
    FetchProtectionRequestsSpecification,
    ProtectionRequestAggregateRoot,
    ProtectionRequestRepository,
    ProtectionRequestKind,
    ProtectionRequestStatus,
} from "../../../src/logion/model/protectionrequest.model";
import { ALICE } from "../../helpers/addresses";

const { connect, disconnect, checkNumOfRows, executeScript } = TestDb;

describe('ProtectionRequestRepositoryTest', () => {

    beforeAll(async () => {
        await connect([ ProtectionRequestAggregateRoot ]);
        await executeScript("test/integration/model/protection_requests.sql");
        repository = new ProtectionRequestRepository();
    });

    let repository: ProtectionRequestRepository;

    afterAll(async () => {
        await disconnect();
    });

    it("findByDecision", async () => {
        const specification = new FetchProtectionRequestsSpecification({
            expectedStatuses: [ 'ACCEPTED', 'REJECTED'],
        });

        const results = await repository.findBy(specification);

        expect(results.length).toBe(3);
        expectAcceptedOrRejected(results);
    });

    it("findByRequesterAddressOnly", async () => {
        let requesterAddress = "5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW";
        const specification = new FetchProtectionRequestsSpecification({
            expectedRequesterAddress: requesterAddress
        });

        const results = await repository.findBy(specification);

        expect(results.length).toBe(1);
    });

    it("findRecoveryOnly", async () => {
        const specification = new FetchProtectionRequestsSpecification({
            expectedStatuses: ['ACCEPTED', 'REJECTED'],
            kind: 'RECOVERY',
        });

        const results = await repository.findBy(specification);

        expect(results.length).toBe(1);
        expectAcceptedOrRejected(results);
        expectKind(results, 'RECOVERY');
    });

    it("findProtectionOnly", async () => {
        const specification = new FetchProtectionRequestsSpecification({
            expectedStatuses: ['ACCEPTED', 'REJECTED', 'ACTIVATED'],
            kind: 'PROTECTION_ONLY',
        });

        const results = await repository.findBy(specification);

        expect(results.length).toBe(3);
        expectAcceptedRejectedActivated(results);
        expectKind(results, 'PROTECTION_ONLY');
    });

    it("findActivatedOnly", async () => {
        const specification = new FetchProtectionRequestsSpecification({
            expectedStatuses: [ 'ACTIVATED' ]
        });

        const results = await repository.findBy(specification);

        expect(results.length).toBe(1);
        expectStatus(results, 'ACTIVATED');
    });

    it("findPendingOnly", async () => {
        const specification = new FetchProtectionRequestsSpecification({
            expectedStatuses: [ 'PENDING' ],
        });

        const results = await repository.findBy(specification);

        expect(results.length).toBe(1);
        expectStatus(results, 'PENDING');
    });
});

describe('ProtectionRequestRepositoryTest', () => {

    beforeAll(async () => {
        await connect([ ProtectionRequestAggregateRoot ]);
        repository = new ProtectionRequestRepository();
    });

    let repository: ProtectionRequestRepository;

    afterAll(async () => {
        await disconnect();
    });

    it("saves protection request", async () => {
        // Given
        const protectionRequest = new ProtectionRequestAggregateRoot()
        protectionRequest.id = '9a7df79e-9d3a-4ef8-b4e1-496bbe30a639'
        protectionRequest.isRecovery = false
        protectionRequest.requesterAddress = '5HQqkmkt6KqxQACPQ2uvH4mHrXouTSbtyT9XWJj8TUaaCE7q'
        protectionRequest.email = 'john.doe@logion.network'
        protectionRequest.phoneNumber = '+1234897'
        protectionRequest.firstName = 'John'
        protectionRequest.lastName = 'Doe'
        protectionRequest.line1 = '15 Rue du Bois'
        protectionRequest.postalCode = '75000'
        protectionRequest.city = 'Paris'
        protectionRequest.country = 'France'
        protectionRequest.status = 'PENDING'
        protectionRequest.otherLegalOfficerAddress = ALICE
        // When
        await repository.save(protectionRequest)
        // Then
        await checkNumOfRows(`SELECT *
                              FROM protection_request
                              WHERE id = '${ protectionRequest.id }'`, 1)
    })
});

function expectAcceptedOrRejected(results: ProtectionRequestAggregateRoot[]) {
    results.forEach(request => expect(request.status).toMatch(/ACCEPTED|REJECTED/));
}

function expectAcceptedRejectedActivated(results: ProtectionRequestAggregateRoot[]) {
    results.forEach(request => expect(request.status).toMatch(/ACCEPTED|REJECTED|ACTIVATED/));
}

function expectKind(results: ProtectionRequestAggregateRoot[], kind: ProtectionRequestKind) {
    if(kind === 'ANY') {
        return;
    }
    results.forEach(request => {
        expect(request.isRecovery!).toBe(kind == 'RECOVERY');
    });
}

function expectStatus(results: ProtectionRequestAggregateRoot[], status: ProtectionRequestStatus) {
    results.forEach(request => {
        expect(request.status!).toBe(status);
    });
}
