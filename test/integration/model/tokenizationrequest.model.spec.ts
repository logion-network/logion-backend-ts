import { connect, disconnect, executeScript } from '../../helpers/testdb';
import {
    FetchRequestsSpecification,
    TokenizationRequestAggregateRoot,
    TokenizationRequestRepository,
    EmbeddableAssetDescription,
} from "../../../src/logion/model/tokenizationrequest.model";
import { ALICE } from '../../../src/logion/model/addresses.model';

describe('TokenizationRequestRepository', () => {

    beforeAll(async () => {
        await connect([TokenizationRequestAggregateRoot, EmbeddableAssetDescription]);
        await executeScript("test/integration/model/tokenization_requests.sql");
        repository = new TokenizationRequestRepository();
    });

    let repository: TokenizationRequestRepository;

    afterAll(async () => {
        await disconnect();
    });

    it("findByLegalOfficerAddress", async () => {
        const query: FetchRequestsSpecification = {
            expectedLegalOfficer: ALICE,
            expectedStatus: 'PENDING',
        };
        const requests = await repository.findBy(query);
        expect(requests.length).toBe(2);
    });

    it("findAcceptedWithoutAssetDescription", async () => {
        const query: FetchRequestsSpecification = {
            expectedLegalOfficer: ALICE,
            expectedStatus: 'ACCEPTED',
            expectedTokenName: "MYT4",
        };
        const requests = await repository.findBy(query);
        expect(requests.length).toBe(1);

        const request = requests[0];
        expect(request.getAssetDescription()).toBeUndefined();
        expect(request.acceptSessionTokenHash).toBeDefined();
    });

    it("findAcceptedWithAssetDescription", async () => {
        const query: FetchRequestsSpecification = {
            expectedLegalOfficer: ALICE,
            expectedStatus: 'ACCEPTED',
            expectedTokenName: "MYT5",
        };
        const requests = await repository.findBy(query);
        expect(requests.length).toBe(1);

        const request = requests[0];
        expect(request.getAssetDescription()).toBeDefined();
        expect(request.acceptSessionTokenHash).toBe(null);
    });
});
