import moment from "moment";
import { TestDb } from "@logion/rest-api-core";
import {
    LocRequestAggregateRoot,
    LocRequestRepository,
    FetchLocRequestsSpecification,
    LocFile,
    LocMetadataItem,
    LocLink, LocType,
} from "../../../src/logion/model/locrequest.model";
import { ALICE, BOB } from "../../helpers/addresses";
import { v4 as uuid } from "uuid";
import { LocRequestService, TransactionalLocRequestService } from "../../../src/logion/services/locrequest.service";

const SUBMITTER = "5DDGQertEH5qvKVXUmpT3KNGViCX582Qa2WWb8nGbkmkRHvw";
const { connect, disconnect, checkNumOfRows, executeScript } = TestDb;

describe('LocRequestRepository - read accesses', () => {

    beforeAll(async () => {
        await connect([ LocRequestAggregateRoot, LocFile, LocMetadataItem, LocLink ]);
        await executeScript("test/integration/model/loc_requests.sql");
        repository = new LocRequestRepository();
    });

    let repository: LocRequestRepository;

    afterAll(async () => {
        await disconnect();
    });

    it("find by owner, status and type", async () => {
        const query: FetchLocRequestsSpecification = {
            expectedOwnerAddress: ALICE,
            expectedStatuses: [ "OPEN", "REQUESTED" ],
            expectedLocTypes: [ "Transaction" ]
        }
        const requests = await repository.findBy(query);
        checkDescription(requests, "Transaction", "loc-1", "loc-2", "loc-4", "loc-5", "loc-10", "loc-17", "loc-18");

        expect(requests[0].getDescription().userIdentity).toBeUndefined();
    })

    it("find LOCS with Polkadot requester", async () => {
        const query: FetchLocRequestsSpecification = {
            expectedIdentityLocType: "Polkadot",
        }
        const requests = await repository.findBy(query);
        checkDescription(requests, undefined, "loc-1", "loc-2", "loc-3", "loc-4", "loc-5",
            "loc-6", "loc-7", "loc-8", "loc-9", "loc-10", "loc-11", "loc-12", "loc-13", "loc-21", "loc-22", "loc-23",
            "loc-24", "loc-25", "loc-26", "loc-27");

        const requestWithItems = requests.find(request => request.description === "loc-10");
        expect(requestWithItems?.files?.length).toBe(1);
        expect(requestWithItems?.metadata?.length).toBe(1);
        expect(requestWithItems?.links?.length).toBe(1);
    })

    it("find LOCS with Logion requester", async () => {
        const query: FetchLocRequestsSpecification = {
            expectedIdentityLocType: "Logion",
        }
        const requests = await repository.findBy(query);
        checkDescription(requests, undefined, "loc-14", "loc-15", "loc-16", "loc-17", "loc-18", "loc-19");
    })

    it("find by requester and status", async () => {
        const query: FetchLocRequestsSpecification = {
            expectedRequesterAddress: "5CXLTF2PFBE89tTYsrofGPkSfGTdmW4ciw4vAfgcKhjggRgZ",
            expectedStatuses: [ "REJECTED" ],
        }
        const requests = await repository.findBy(query);
        checkDescription(requests, "Transaction", "loc-7")

        expect(requests[0].getDescription().requesterAddress).toBe("5CXLTF2PFBE89tTYsrofGPkSfGTdmW4ciw4vAfgcKhjggRgZ");
        expect(requests[0].getDescription().ownerAddress).toBe("5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY");
        expect(requests[0].getDescription().userIdentity).toEqual({
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@logion.network',
            phoneNumber: '+123456',
        });
        expect(requests[0].status).toBe("REJECTED");
    })

    it("finds loc with files, metadata and links", async () => {
        const request = await repository.findById(LOC_WITH_FILES);
        checkDescription([request!], "Transaction", "loc-10");

        const hash = "0x1307990e6ba5ca145eb35e99182a9bec46531bc54ddf656a602c780fa0240dee";
        expect(request!.getFiles(request?.ownerAddress).length).toBe(1);
        expect(request!.hasFile(hash)).toBe(true);
        const file = request!.getFile(hash);
        expect(file.name).toBe("a file");
        expect(file.hash).toBe(hash);
        expect(file.oid).toBe(123456);
        expect(file.addedOn!.isSame(moment("2021-10-06T11:16:00.000"))).toBe(true);
        expect(file.nature).toBe("some nature")
        expect(request!.files![0].draft).toBe(true);

        const metadata = request!.getMetadataItems(request?.ownerAddress);
        expect(metadata.length).toBe(1);
        expect(metadata[0].name).toBe("a name");
        expect(metadata[0].value).toBe("a value");
        expect(metadata[0].addedOn!.isSame(moment("2021-10-06T11:16:00.000"))).toBe(true);
        expect(request!.metadata![0].draft).toBe(true);

        const links = request!.getLinks(request?.ownerAddress);
        expect(links.length).toBe(1);
        expect(links[0].target).toBe("ec126c6c-64cf-4eb8-bfa6-2a98cd19ad5d");
        expect(links[0].addedOn!.isSame(moment("2021-10-06T11:16:00.000"))).toBe(true);
        expect(links[0].nature).toBe("link-nature")
        expect(request!.links![0].draft).toBe(true);
    })

    it("populates requesterIdentityLoc", async () => {
        const request = await repository.findById(LOGION_TRANSACTION_LOC_ID);
        expect(request?.requesterIdentityLocId).toBeDefined();
    })

    it("finds verified third parties", async () => {
        const requests = await repository.findBy({
            expectedOwnerAddress: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
            isVerifiedThirdParty: true,
        });
        expect(requests.length).toBe(1);
    })

    it("gets VTP identity LOC", async () => {
        const identityLoc = await repository.getVerifiedThirdPartyIdentityLoc("5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW");
        expect(identityLoc).toBeDefined();
    })

    it("finds by requester and owner", async () => {
        const query: FetchLocRequestsSpecification = {
            expectedOwnerAddress: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
            expectedRequesterAddress: "5CXLTF2PFBE89tTYsrofGPkSfGTdmW4ciw4vAfgcKhjggRgZ",
        }
        const requests = await repository.findBy(query);
        checkDescription(requests, undefined, "loc-1", "loc-4", "loc-7", "loc-10", "loc-11", "loc-21", "loc-24");
    })
})

describe('LocRequestRepository.save()', () => {

    beforeAll(async () => {
        await connect([ LocRequestAggregateRoot, LocFile, LocMetadataItem, LocLink ]);
        repository = new LocRequestRepository();
        service = new TransactionalLocRequestService(repository);
    });

    let repository: LocRequestRepository;

    let service: LocRequestService;

    afterAll(async () => {
        await disconnect();
    });

    it("saves a LocRequest aggregate", async () => {
        const locTypes: LocType[] = ["Collection", "Transaction"];
        for (const locType of locTypes) {
            const id = uuid();
            const locRequest = givenLoc(id, locType, "OPEN");
            await service.addNewRequest(locRequest);
            await checkAggregate(id, 1);
        }
    })

    it("rollbacks when trying to add invalid link", async () => {
        const locTypes: LocType[] = ["Collection", "Transaction"];
        for (const locType of locTypes) {
            const id = uuid();
            const locRequest = givenLoc(id, locType, "OPEN");
            await service.addNewRequest(locRequest);
            try {
                await service.update(id, async request => {
                    request.links![0].target = undefined;
                });
            } catch(e) {
                expect((e as any).toString()).toBe("QueryFailedError: null value in column \"target\" violates not-null constraint");
            }
            await checkAggregate(id, 1, 0);
        }
    })

    it("deletes a draft LocRequest aggregate", async () => {
        const id = uuid()
        const locRequest = givenLoc(id, "Transaction", "DRAFT")
        await service.addNewRequest(locRequest);
        await service.deleteDraftOrRejected(id, async () => {});
        await checkAggregate(id, 0)
    })

    it("deletes a rejected LocRequest aggregate", async () => {
        const id = uuid()
        const locRequest = givenLoc(id, "Transaction", "DRAFT")
        locRequest.submit();
        locRequest.reject("Because", moment());
        await service.addNewRequest(locRequest);
        await service.deleteDraftOrRejected(id, async () => {});
        await checkAggregate(id, 0);
    })
})

describe('LocRequestRepository - LOC correctly ordered', () => {

    beforeAll(async () => {
        await connect([ LocRequestAggregateRoot, LocFile, LocMetadataItem, LocLink ]);
        await executeScript("test/integration/model/loc_requests_order.sql");
        repository = new LocRequestRepository();
    });

    let repository: LocRequestRepository;

    afterAll(async () => {
        await disconnect();
    });

    it("deletes a draft LocRequest aggregate", async () => {
        const locs = await repository.findBy({
            expectedLocTypes: ["Collection", "Identity", "Transaction"],
            expectedOwnerAddress: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
            expectedStatuses: ["CLOSED", "OPEN", "REJECTED", "REQUESTED"]
        });

        const descriptions = locs.map(loc => loc.description);
        expect(descriptions).toEqual([
            "ordered-loc-2",
            "ordered-loc-1",
            "ordered-loc-10",
            "ordered-loc-9",
            "ordered-loc-4",
            "ordered-loc-3",
            "ordered-loc-6",
            "ordered-loc-5",
            "ordered-loc-8",
            "ordered-loc-7",
        ])
    });
});

function givenLoc(id: string, locType: LocType, status: "OPEN" | "DRAFT"): LocRequestAggregateRoot {
    const locRequest = new LocRequestAggregateRoot();
    locRequest.id = id;
    locRequest.requesterAddress = "5CXLTF2PFBE89tTYsrofGPkSfGTdmW4ciw4vAfgcKhjggRgZ"
    locRequest.ownerAddress = BOB
    locRequest.description = "I want to open a case"
    locRequest.locType = locType
    locRequest.createdOn = moment().toISOString()
    locRequest.status = status

    locRequest.links = []
    locRequest.addLink({
        target: uuid(),
        nature: "link nature",
        addedOn: moment()
    })
    locRequest.files = []
    locRequest.addFile({
        name: "fileName",
        addedOn: moment(),
        hash: "hash",
        oid: 123,
        contentType: "content/type",
        nature: "nature1",
        submitter: SUBMITTER,
    })
    locRequest.metadata = []
    locRequest.addMetadataItem({
        name: "itemName",
        addedOn: moment(),
        value: "something valuable",
        submitter: SUBMITTER,
    })
    return locRequest;
}

async function checkAggregate(id: string, numOfRows: number, numOfItems?: number) {
    await checkNumOfRows(`SELECT *
                          FROM loc_request
                          WHERE id = '${ id }'`, numOfRows)
    await checkNumOfRows(`SELECT *
                          FROM loc_link
                          WHERE request_id = '${ id }'`, numOfItems || numOfRows)
    await checkNumOfRows(`SELECT *
                          FROM loc_metadata_item
                          WHERE request_id = '${ id }'`, numOfItems || numOfRows)
    await checkNumOfRows(`SELECT *
                          FROM loc_request_file
                          WHERE request_id = '${ id }'`, numOfItems || numOfRows)
}

function checkDescription(requests: LocRequestAggregateRoot[], expectedLocType: LocType | undefined, ...descriptions: string[]) {
    expect(requests.length).toBe(descriptions.length);
    descriptions.forEach(description => {
        const matchingRequests = requests.filter(request => request.getDescription().description === description);
        expect(matchingRequests.length).withContext(`loc with description ${ description } not returned by query`).toBe(1);
        if (expectedLocType) {
            expect(matchingRequests[0].locType).toBe(expectedLocType);
        }
    })
}

const LOC_WITH_FILES = "2b287596-f9d5-8030-b606-d1da538cb37f";
const LOGION_TRANSACTION_LOC_ID = "f93bc0d2-f443-49ff-a9de-a6331167b267";
