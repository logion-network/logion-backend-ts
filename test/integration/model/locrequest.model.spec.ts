import { connect, executeScript, disconnect } from "../../helpers/testdb";
import {
    LocRequestAggregateRoot,
    LocRequestRepository,
    FetchLocRequestsSpecification
} from "../../../src/logion/model/locrequest.model";
import { ALICE } from "../../../src/logion/model/addresses.model";

describe('LocRequestRepository', () => {

    beforeAll(async () => {
        await connect([ LocRequestAggregateRoot ]);
        await executeScript("test/integration/model/loc_requests.sql");
        repository = new LocRequestRepository();
    });

    let repository: LocRequestRepository;

    afterAll(async () => {
        await disconnect();
    });

    it("find by owner and status", async () => {
        const query: FetchLocRequestsSpecification = {
            expectedOwnerAddress: ALICE,
            expectedStatuses: [ "OPEN", "REQUESTED" ],
        }
        const requests = await repository.findBy(query);
        checkDescription(requests, "loc-1", "loc-2", "loc-4", "loc-5")
    })

    it("find by requester and status", async () => {
        const query: FetchLocRequestsSpecification = {
            expectedRequesterAddress: "5CXLTF2PFBE89tTYsrofGPkSfGTdmW4ciw4vAfgcKhjggRgZ",
            expectedStatuses: [ "REJECTED" ],
        }
        const requests = await repository.findBy(query);
        checkDescription(requests, "loc-7")

        expect(requests[0].getDescription().requesterAddress).toBe("5CXLTF2PFBE89tTYsrofGPkSfGTdmW4ciw4vAfgcKhjggRgZ");
        expect(requests[0].getDescription().ownerAddress).toBe("5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY");
        expect(requests[0].status).toBe("REJECTED");
    })
})

function checkDescription(requests: LocRequestAggregateRoot[], ...descriptions: string[]) {
    expect(requests.length).toBe(descriptions.length);
    descriptions.forEach(description => {
        const matchingRequests = requests.filter(request => request.getDescription().description === description);
        expect(matchingRequests.length).toBe(1, `loc with description ${description} not returned by query`);
    })
}
