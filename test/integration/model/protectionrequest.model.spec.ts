import { connect, disconnect, executeScript } from '../../helpers/testdb';
import {
    FetchProtectionRequestsSpecification,
    ProtectionRequestAggregateRoot,
    ProtectionRequestRepository,
    ProtectionRequestKind,
    ProtectionRequestStatus,
} from "../../../src/logion/model/protectionrequest.model";

describe('ProtectionRequestRepositoryTest', () => {

    beforeAll(async () => {
        await connect([ProtectionRequestAggregateRoot]);
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
