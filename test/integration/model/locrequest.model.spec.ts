import moment from "moment";
import { requireDefined, TestDb } from "@logion/rest-api-core";
import {
    LocRequestAggregateRoot,
    LocRequestRepository,
    FetchLocRequestsSpecification,
    LocFile,
    LocMetadataItem,
    LocLink,
    LocType,
    LocFileDelivered,
} from "../../../src/logion/model/locrequest.model.js";
import { ALICE, BOB } from "../../helpers/addresses.js";
import { v4 as uuid } from "uuid";
import { LocRequestService, TransactionalLocRequestService } from "../../../src/logion/services/locrequest.service.js";

const SUBMITTER = "5DDGQertEH5qvKVXUmpT3KNGViCX582Qa2WWb8nGbkmkRHvw";
const { connect, disconnect, checkNumOfRows, executeScript } = TestDb;
const ENTITIES = [ LocRequestAggregateRoot, LocFile, LocMetadataItem, LocLink, LocFileDelivered ];

describe('LocRequestRepository - read accesses', () => {

    beforeAll(async () => {
        await connect(ENTITIES);
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

        expect(requests[0].iDenfyVerification?.authToken).toBeNull();
        expect(requests[0].iDenfyVerification?.scanRef).toBeNull();
        expect(requests[0].iDenfyVerification?.status).toBeNull();
        expect(requests[0].iDenfyVerification?.callbackPayload).toBeNull();
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

    it("finds one LOC with restricted deliveries", async () => {
        const request = requireDefined(await repository.findById("15ed922d-5960-4147-a73f-97d362cb7c46"));
        expect(request.files?.length).toBe(1);
        const file = request.files![0];
        expect(file.delivered?.length).toBe(3);
    });

    it("finds LOC with restricted deliveries based on criteria", async () => {
        const requests = await repository.findBy({
            expectedOwnerAddress: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
            isVerifiedThirdParty: true,
        });
        const request = requests[0];
        expect(request.files?.length).toBe(1);
        const file = request.files![0];
        expect(file.delivered?.length).toBe(3);
    });

    it("finds deliveries", async () => {
        const delivered = await repository.findAllDeliveries({
            collectionLocId: "15ed922d-5960-4147-a73f-97d362cb7c46",
            hash: "0x1307990e6ba5ca145eb35e99182a9bec46531bc54ddf656a602c780fa0240dee"
        })
        expect(delivered.length).toEqual(3);
        expect(delivered[0].owner).toEqual("5Eewz58eEPS81847EezkiFENE3kG8fxrx1BdRWyFJAudPC6m");
        expect(delivered[0].deliveredFileHash).toEqual("0xc14d46b478dcb21833b90dc9880aa3a7507b01aa5d033c64051df999f3c3bba0");
        expect(delivered[1].owner).toEqual("5DDGQertEH5qvKVXUmpT3KNGViCX582Qa2WWb8nGbkmkRHvw");
        expect(delivered[1].deliveredFileHash).toEqual("0xf35e4bcbc1b0ce85af90914e04350cce472a2f01f00c0f7f8bc5c7ba04da2bf2");
        expect(delivered[2].owner).toEqual("5H9ZP7zyJtmay2Vcstf7SzK8LD1PGe5PJ8q7xakqp4zXFEwz");
        expect(delivered[2].deliveredFileHash).toEqual("0x38df2378ed26e20124d8c38a945af1b4a058656aab3b3b1f71a9d8a629cc0d81");
    })
})

describe('LocRequestRepository.save()', () => {

    beforeAll(async () => {
        await connect(ENTITIES);
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

    it("updates file", async () => {
        const id = uuid();
        const locRequest = givenLoc(id, "Collection", "OPEN");
        await service.addNewRequest(locRequest);
        await service.update(id, async request => {
            request.updateFile({
                hash: "hash",
                restrictedDelivery: true,
            });
        });
        const updatedRequest = await repository.findById(id);
        expect(updatedRequest?.files![0].restrictedDelivery).toBe(true);
    })
})

describe('LocRequestRepository - LOC correctly ordered', () => {

    beforeAll(async () => {
        await connect(ENTITIES);
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
        restrictedDelivery: false,
        size: 789,
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
