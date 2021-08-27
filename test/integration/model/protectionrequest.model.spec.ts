import { connect, disconnect, executeScript } from '../../helpers/testdb';
import {
    FetchProtectionRequestsSpecification,
    LegalOfficerDecision,
    ProtectionRequestAggregateRoot,
    ProtectionRequestRepository,
    ProtectionRequestKind,
    ProtectionRequestStatus,
} from "../../../src/logion/model/protectionrequest.model";
import { ALICE, BOB } from '../../../src/logion/model/addresses.model';

describe('ProtectionRequestRepositoryTest', () => {

    beforeAll(async () => {
        await connect([ProtectionRequestAggregateRoot, LegalOfficerDecision]);
        await executeScript("test/integration/model/protection_requests.sql");
        repository = new ProtectionRequestRepository();
    });

    let repository: ProtectionRequestRepository;

    afterAll(async () => {
        await disconnect();
    });

    it("findBy", async () => {
        const specification = new FetchProtectionRequestsSpecification({
            expectedLegalOfficer: ALICE,
            expectedDecisionStatuses: [ 'ACCEPTED', 'REJECTED'],
        });

        const results = await repository.findBy(specification);

        expect(results.length).toBe(4);
        expectAcceptedOrRejected(results);
    });

    it("findByRequesterAddress", async () => {
        let requesterAddress = "5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW";
        const specification = new FetchProtectionRequestsSpecification({
            expectedRequesterAddress: requesterAddress
        });

        const results = await repository.findBy(specification);

        expect(results.length).toBe(1);

        const protectionRequest = results[0];
        const legalOfficerDecisionDescriptions = protectionRequest.decisions!;
        expect(legalOfficerDecisionDescriptions.length).toBe(2);

        const legalOfficerAddresses = legalOfficerDecisionDescriptions
                .map(decision => decision.legalOfficerAddress);
        expect(legalOfficerAddresses.includes(ALICE)).toBe(true);
        expect(legalOfficerAddresses.includes(BOB)).toBe(true);
    });

    it("findRecoveryOnly", async () => {
        const specification = new FetchProtectionRequestsSpecification({
            expectedLegalOfficer: ALICE,
            expectedDecisionStatuses: ['ACCEPTED', 'REJECTED'],
            kind: 'RECOVERY',
        });

        const results = await repository.findBy(specification);

        expect(results.length).toBe(1);
        expectAcceptedOrRejected(results);
        expectKind(results, 'RECOVERY');
    });

    it("findProtectionOnly", async () => {
        const specification = new FetchProtectionRequestsSpecification({
            expectedLegalOfficer: ALICE,
            expectedDecisionStatuses: ['ACCEPTED', 'REJECTED'],
            kind: 'PROTECTION_ONLY',
        });

        const results = await repository.findBy(specification);

        expect(results.length).toBe(3);
        expectAcceptedOrRejected(results);
        expectKind(results, 'PROTECTION_ONLY');
    });

    it("findActivatedOnly", async () => {
        const specification = new FetchProtectionRequestsSpecification({
            expectedLegalOfficer: ALICE,
            expectedProtectionRequestStatus: 'ACTIVATED',
        });

        const results = await repository.findBy(specification);

        expect(results.length).toBe(1);
        expectStatus(results, 'ACTIVATED');
    });

    it("findPendingOnly", async () => {
        const specification = new FetchProtectionRequestsSpecification({
            expectedLegalOfficer: ALICE,
            expectedProtectionRequestStatus: 'PENDING',
        });

        const results = await repository.findBy(specification);

        expect(results.length).toBe(4);
        expectStatus(results, 'PENDING');
    });
});

function expectAcceptedOrRejected(results: ProtectionRequestAggregateRoot[]) {
    results.forEach(request => {
        expect(request.decisions!.length).toBe(2);
        request.decisions!.forEach(decision => expect(decision.status).toMatch(/ACCEPTED|REJECTED/))
    });
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
