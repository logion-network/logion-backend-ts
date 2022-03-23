import { connect, disconnect, executeScript, checkNumOfRows } from '../../helpers/testdb';
import {
    FetchVaultTransferRequestsSpecification,
    VaultTransferRequestAggregateRoot,
    VaultTransferRequestRepository,
    VaultTransferRequestStatus,
} from "../../../src/logion/model/vaulttransferrequest.model";

describe('VaultTransferRequestRepository queries', () => {

    beforeAll(async () => {
        await connect([ VaultTransferRequestAggregateRoot ]);
        await executeScript("test/integration/model/vault_transfer_requests.sql");
        repository = new VaultTransferRequestRepository();
    });

    let repository: VaultTransferRequestRepository;

    afterAll(async () => {
        await disconnect();
    });

    it("findByDecision", async () => {
        const specification = new FetchVaultTransferRequestsSpecification({
            expectedStatuses: [ 'ACCEPTED', 'REJECTED'],
        });

        const results = await repository.findBy(specification);

        expect(results.length).toBe(2);
        expectAcceptedOrRejected(results);
    });

    it("findByRequesterAddressOnly", async () => {
        let requesterAddress = "5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW";
        const specification = new FetchVaultTransferRequestsSpecification({
            expectedRequesterAddress: requesterAddress
        });

        const results = await repository.findBy(specification);

        expect(results.length).toBe(1);
    });

    it("findPendingOnly", async () => {
        const specification = new FetchVaultTransferRequestsSpecification({
            expectedStatuses: [ 'PENDING' ],
        });

        const results = await repository.findBy(specification);

        expect(results.length).toBe(1);
        expectStatus(results, 'PENDING');
    });
});

describe('VaultTransferRequestRepository updates', () => {

    beforeAll(async () => {
        await connect([ VaultTransferRequestAggregateRoot ]);
        repository = new VaultTransferRequestRepository();
    });

    let repository: VaultTransferRequestRepository;

    afterAll(async () => {
        await disconnect();
    });

    it("saves request", async () => {
        // Given
        const request = new VaultTransferRequestAggregateRoot();
        request.id = '9a7df79e-9d3a-4ef8-b4e1-496bbe30a639';
        request.requesterAddress = '5HQqkmkt6KqxQACPQ2uvH4mHrXouTSbtyT9XWJj8TUaaCE7q';
        request.origin = '5HQqkmkt6KqxQACPQ2uvH4mHrXouTSbtyT9XWJj8TUaaCE7q';
        request.destination = '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty';
        request.amount = '10000';
        request.blockNumber = "4242";
        request.extrinsicIndex = 42;
        request.status = 'PENDING';
        // When
        await repository.save(request);
        // Then
        await checkNumOfRows(`SELECT *
                              FROM vault_transfer_request
                              WHERE id = '${ request.id }'`, 1);
    })
});

function expectAcceptedOrRejected(results: VaultTransferRequestAggregateRoot[]) {
    results.forEach(request => expect(request.status).toMatch(/ACCEPTED|REJECTED/));
}

function expectStatus(results: VaultTransferRequestAggregateRoot[], status: VaultTransferRequestStatus) {
    results.forEach(request => {
        expect(request.status!).toBe(status);
    });
}
