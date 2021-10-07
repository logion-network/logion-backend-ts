import moment from "moment";
import { connect, executeScript, disconnect } from "../../helpers/testdb";
import {
    LocRequestAggregateRoot,
    LocRequestRepository,
    FetchLocRequestsSpecification,
    LocFile,
    LocMetadataItem
} from "../../../src/logion/model/locrequest.model";
import { ALICE } from "../../../src/logion/model/addresses.model";

describe('LocRequestRepository', () => {

    beforeAll(async () => {
        await connect([ LocRequestAggregateRoot, LocFile, LocMetadataItem ]);
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
        checkDescription(requests, "loc-1", "loc-2", "loc-4", "loc-5", "loc-10");

        expect(requests[0].getDescription().userIdentity).toBeUndefined();
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
        expect(requests[0].getDescription().userIdentity).toEqual({
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@logion.network',
            phoneNumber: '+123456'
        });
        expect(requests[0].status).toBe("REJECTED");
    })

    it("finds loc with files and metadata", async () => {
        const request = await repository.findById(LOC_WITH_FILES);
        checkDescription([request!], "loc-10");

        const hash = "0x1307990e6ba5ca145eb35e99182a9bec46531bc54ddf656a602c780fa0240dee";
        expect(request!.hasFile(hash)).toBe(true);
        const file = request!.getFile(hash);
        expect(file.name).toBe("a file");
        expect(file.hash).toBe(hash);
        expect(file.oid).toBe(123456);
        expect(file.addedOn!.isSame(moment("2021-10-06T11:16:00.000"))).toBe(true);
        expect(request!.files![0].draft).toBe(true);

        const metadata = request!.getMetadataItems();
        expect(metadata.length).toBe(1);
        expect(metadata[0].name).toBe("a name");
        expect(metadata[0].value).toBe("a value");
        expect(metadata[0].addedOn.isSame(moment("2021-10-06T11:16:00.000"))).toBe(true);
    })
})

function checkDescription(requests: LocRequestAggregateRoot[], ...descriptions: string[]) {
    expect(requests.length).toBe(descriptions.length);
    descriptions.forEach(description => {
        const matchingRequests = requests.filter(request => request.getDescription().description === description);
        expect(matchingRequests.length).withContext(`loc with description ${description} not returned by query`).toBe(1);
    })
}

const LOC_WITH_FILES = "2b287596-f9d5-8030-b606-d1da538cb37f";
