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
    EmbeddableLocFees,
} from "../../../src/logion/model/locrequest.model.js";
import { ALICE_ACCOUNT, BOB_ACCOUNT } from "../../helpers/addresses.js";
import { v4 as uuid } from "uuid";
import { LocRequestService, TransactionalLocRequestService } from "../../../src/logion/services/locrequest.service.js";
import { Hash, UUID, ValidAccountId } from "@logion/node-api";
import { EmbeddableNullableAccountId, DB_SS58_PREFIX } from "../../../src/logion/model/supportedaccountid.model.js";

const SUBMITTER = ValidAccountId.polkadot("129ZYz7x64MKMrW3SQsTBUCRMLCAmRaYeXEzkRmd9qoGbqQi");
const { connect, disconnect, checkNumOfRows, executeScript } = TestDb;
const ENTITIES = [ LocRequestAggregateRoot, LocFile, LocMetadataItem, LocLink, LocFileDelivered ];
const hash = Hash.fromHex("0x1307990e6ba5ca145eb35e99182a9bec46531bc54ddf656a602c780fa0240dee");
const anotherHash = Hash.fromHex("0x5a60f0a435fa1c508ccc7a7dd0a0fe8f924ba911b815b10c9ef0ddea0c49052e");
const collectionLocId = "15ed922d-5960-4147-a73f-97d362cb7c46";
const VOID_REASON = "Some reason";
const requester = ValidAccountId.polkadot("5CXLTF2PFBE89tTYsrofGPkSfGTdmW4ciw4vAfgcKhjggRgZ");

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
            expectedOwnerAddress: [ ALICE_ACCOUNT ],
            expectedStatuses: [ "OPEN", "REVIEW_PENDING" ],
            expectedLocTypes: [ "Transaction" ]
        }
        const requests = await repository.findBy(query);
        checkDescription(requests, "Transaction", "loc-1", "loc-2", "loc-4", "loc-5", "loc-10", "loc-17", "loc-18");

        expect(requests[0].getDescription().userIdentity).toBeUndefined();

        expect(requests[0].iDenfyVerification?.authToken).toBeNull();
        expect(requests[0].iDenfyVerification?.scanRef).toBeNull();
        expect(requests[0].iDenfyVerification?.status).toBeNull();
        expect(requests[0].iDenfyVerification?.callbackPayload).toBeNull();

        expect(await repository.existsBy(query)).toBeTrue();
    })

    it("find LOCS with Polkadot requester", async () => {
        const query: FetchLocRequestsSpecification = {
            expectedIdentityLocType: "Polkadot",
        }
        const requests = await repository.findBy(query);
        checkDescription(requests, undefined, "loc-1", "loc-2", "loc-3", "loc-4", "loc-5",
            "loc-6", "loc-7", "loc-8", "loc-9", "loc-10", "loc-11", "loc-12", "loc-13", "loc-21", "loc-22", "loc-23",
            "loc-24", "loc-25", "loc-26", "loc-27", "loc-29");

        const requestWithItems = requests.find(request => request.description === "loc-10");
        expect(requestWithItems?.files?.length).toBe(1);
        expect(requestWithItems?.metadata?.length).toBe(1);
        expect(requestWithItems?.links?.length).toBe(1);

        expect(await repository.existsBy(query)).toBeTrue();
    })

    it("find LOCS with Logion requester", async () => {
        const query: FetchLocRequestsSpecification = {
            expectedIdentityLocType: "Logion",
        }
        const requests = await repository.findBy(query);
        checkDescription(requests, undefined, "loc-14", "loc-15", "loc-16", "loc-17", "loc-18", "loc-19");

        expect(await repository.existsBy(query)).toBeTrue();
    })

    it("find by requester and status", async () => {
        const query: FetchLocRequestsSpecification = {
            expectedRequesterAddress: requester,
            expectedStatuses: [ "REVIEW_REJECTED" ],
        }
        const requests = await repository.findBy(query);
        checkDescription(requests, "Transaction", "loc-7")

        expect(requests[0].getDescription().requesterAddress?.address).toBe(requester.address);
        expect(requests[0].getDescription().requesterAddress?.type).toBe("Polkadot");
        expect(requests[0].getDescription().ownerAddress.address).toBe(ALICE_ACCOUNT.address);
        expect(requests[0].getDescription().ownerAddress.type).toBe("Polkadot");
        expect(requests[0].getDescription().userIdentity).toEqual({
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@logion.network',
            phoneNumber: '+123456',
        });
        expect(requests[0].status).toBe("REVIEW_REJECTED");

        expect(await repository.existsBy(query)).toBeTrue();
    })

    it("finds collection with params", async() => {
        const request = await repository.findById(COLLECTION_WITH_PARAMS);
        const { collectionParams } = request!.getDescription();
        expect(collectionParams?.lastBlockSubmission).toEqual(10000000n);
        expect(collectionParams?.maxSize).toEqual(9999);
        expect(collectionParams?.canUpload).toBeTrue();
    })

    it("finds loc with files, metadata and links", async () => {
        const request = await repository.findById(LOC_WITH_FILES);
        checkDescription([request!], "Transaction", "loc-10");

        expect(request!.getFiles(request?.getOwner()).length).toBe(1);
        expect(request!.hasFile(hash)).toBe(true);
        const file = request!.getFile(hash);
        expect(file.name).toBe("a file");
        expect(file.hash).toEqual(hash);
        expect(file.oid).toBe(123456);
        expect(file.addedOn!.isSame(moment("2021-10-06T11:16:00.000"))).toBe(true);
        expect(file.nature).toBe("some nature");
        expect(file.size).toBe(123);
        expect(request!.files![0].status).toBe("DRAFT");

        const metadata = request!.getMetadataItems(request?.getOwner());
        expect(metadata.length).toBe(1);
        expect(metadata[0].name).toBe("a name");
        expect(metadata[0].nameHash.toHex()).toBe("0x36e96c62633613d6f8e98943830ed5c5f814c2bb9214d8bba577386096bc926a");
        expect(metadata[0].value).toBe("a value");
        expect(metadata[0].addedOn!.isSame(moment("2021-10-06T11:16:00.000"))).toBe(true);
        expect(request!.metadata![0].status).toBe("DRAFT");

        const links = request!.getLinks(request?.getOwner());
        expect(links.length).toBe(1);
        expect(links[0].target).toBe("ec126c6c-64cf-4eb8-bfa6-2a98cd19ad5d");
        expect(links[0].addedOn!.isSame(moment("2021-10-06T11:16:00.000"))).toBe(true);
        expect(links[0].nature).toBe("link-nature")
        expect(request!.links![0].status).toBe("DRAFT");
    })

    it("populates requesterIdentityLoc", async () => {
        const request = await repository.findById(LOGION_TRANSACTION_LOC_ID);
        expect(request?.requesterIdentityLocId).toBeDefined();
    })

    it("finds by requester and owner", async () => {
        const query: FetchLocRequestsSpecification = {
            expectedOwnerAddress: [ ALICE_ACCOUNT ],
            expectedRequesterAddress: requester,
        }
        const requests = await repository.findBy(query);
        checkDescription(requests, undefined, "loc-1", "loc-4", "loc-7", "loc-10", "loc-11", "loc-21", "loc-24");

        expect(await repository.existsBy(query)).toBeTrue();
    })

    it("finds Identity LOC with Ethereum requester", async () => {
        const query: FetchLocRequestsSpecification = {
            expectedIdentityLocType: "Ethereum",
        }
        const requests = await repository.findBy(query);
        checkDescription(requests, "Identity", "loc-28");
        expect(requests[0].sponsorshipId).toBeDefined();

        expect(await repository.existsBy(query)).toBeTrue();
    })

    it("finds Identity LOC by sponsorship id", async () => {
        const query: FetchLocRequestsSpecification = {
            expectedSponsorshipId: new UUID("31f59983-229f-43e1-9d11-435f506b722b")
        }
        const requests = await repository.findBy(query);
        checkDescription(requests, "Identity", "loc-28");

        expect(await repository.existsBy(query)).toBeTrue();
    })

    it("finds one LOC with restricted deliveries", async () => {
        const request = requireDefined(await repository.findById(collectionLocId));
        expect(request.files?.length).toBe(2);
        const file = request.files![0];
        expect(file.delivered?.length).toBe(3);
    });

    it("finds LOC with restricted deliveries based on criteria", async () => {
        const query: FetchLocRequestsSpecification = {
            expectedOwnerAddress: [ ALICE_ACCOUNT ],
            expectedRequesterAddress: ValidAccountId.polkadot("5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW"),
            expectedStatuses: ["CLOSED"],
            expectedLocTypes:["Identity"],
        };
        const requests = await repository.findBy(query);
        const request = requests[0];
        expect(request.files?.length).toBe(2);
        const file = request.files![0];
        expect(file.delivered?.length).toBe(3);

        expect(await repository.existsBy(query)).toBeTrue();
    });

    it("finds deliveries", async () => {
        const delivered = await repository.findAllDeliveries({
            collectionLocId: collectionLocId,
            hash,
        })
        checkDelivery(delivered);
        expect(delivered[anotherHash.toHex()]).toBeUndefined();
    })

    it("finds all deliveries", async () => {
        const delivered = await repository.findAllDeliveries({
            collectionLocId: collectionLocId,
        })
        checkDelivery(delivered);
        expect(delivered[anotherHash.toHex()].length).toEqual(1);
        expect(delivered[anotherHash.toHex()][0].owner).toEqual("5DDGQertEH5qvKVXUmpT3KNGViCX582Qa2WWb8nGbkmkRHvw");
        expect(delivered[anotherHash.toHex()][0].deliveredFileHash).toEqual("0xdbfaa07666457afd3cdc6fb2726a94cde7a0f613a0f354e695b315372a098e8a");
    })

    it("finds one delivery by copy hash", async () => {
        const deliveredFileHash = Hash.fromHex("0xdbfaa07666457afd3cdc6fb2726a94cde7a0f613a0f354e695b315372a098e8a");
        const delivered = await repository.findDeliveryByDeliveredFileHash({ collectionLocId, deliveredFileHash})
        expect(delivered?.owner).toEqual("5DDGQertEH5qvKVXUmpT3KNGViCX582Qa2WWb8nGbkmkRHvw");
        expect(delivered?.hash).toEqual("0x5a60f0a435fa1c508ccc7a7dd0a0fe8f924ba911b815b10c9ef0ddea0c49052e");
        expect(delivered?.deliveredFileHash).toEqual(deliveredFileHash.toHex());
    })

    it("finds no delivery with unknown copy hash", async () => {
        const delivered = await repository.findDeliveryByDeliveredFileHash({ collectionLocId, deliveredFileHash: Hash.fromHex("0xb8af3be22a2395a9961cfe43cdbc7e731f334c8272a9903db29d4ff584b3934a")})
        expect(delivered).toBeNull();
    })

    it("existsBy returns false on non-existent data", async () => {
        const unknown = ValidAccountId.polkadot("vQxd7xqHPutXFzb1eD6y757J4vfv6BCvYXZ7KPn9ZUFGHSHF6");
        const results: boolean[] = await Promise.all([
            repository.existsBy({ "expectedOwnerAddress": [ unknown ] }),
            repository.existsBy({ "expectedRequesterAddress": unknown }),
            repository.existsBy({ "expectedSponsorshipId": new UUID("b293fccf-0972-4d20-b04e-757db329ec57") })
        ]);
        expect(results).toEqual([ false, false, false ]);
    })

    it("finds workload", async () => {
        const query: FetchLocRequestsSpecification = {
            expectedOwnerAddress: [ ALICE_ACCOUNT, BOB_ACCOUNT ],
            expectedStatuses: [ "REVIEW_PENDING" ],
        }
        const requests = await repository.findBy(query);
        checkDescription(requests, undefined, "loc-1", "loc-2", "loc-3", "loc-21", "loc-22", "loc-23");

    })

    function checkDelivery(delivered: Record<string, LocFileDelivered[]>) {
        expect(delivered[hash.toHex()].length).toEqual(3);
        expect(delivered[hash.toHex()][0].owner).toEqual("5Eewz58eEPS81847EezkiFENE3kG8fxrx1BdRWyFJAudPC6m");
        expect(delivered[hash.toHex()][0].deliveredFileHash).toEqual("0xc14d46b478dcb21833b90dc9880aa3a7507b01aa5d033c64051df999f3c3bba0");
        expect(delivered[hash.toHex()][1].owner).toEqual("5DDGQertEH5qvKVXUmpT3KNGViCX582Qa2WWb8nGbkmkRHvw");
        expect(delivered[hash.toHex()][1].deliveredFileHash).toEqual("0xf35e4bcbc1b0ce85af90914e04350cce472a2f01f00c0f7f8bc5c7ba04da2bf2");
        expect(delivered[hash.toHex()][2].owner).toEqual("5H9ZP7zyJtmay2Vcstf7SzK8LD1PGe5PJ8q7xakqp4zXFEwz");
        expect(delivered[hash.toHex()][2].deliveredFileHash).toEqual("0x38df2378ed26e20124d8c38a945af1b4a058656aab3b3b1f71a9d8a629cc0d81");
    }

    it("finds valid Polkadot Identity LOC", async() => {
        const request = await repository.getValidPolkadotIdentityLoc(
            ValidAccountId.polkadot("5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW"),
            ValidAccountId.polkadot("5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"),
        );
        expect(request).toBeDefined();
    })

    it("finds non void Polkadot Identity LOC", async() => {
        const request = await repository.getNonVoidIdentityLoc(
            ValidAccountId.polkadot("5CXLTF2PFBE89tTYsrofGPkSfGTdmW4ciw4vAfgcKhjggRgZ"),
            ValidAccountId.polkadot("5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"),
        );
        expect(request).toBeDefined();
    })

    it("does not find void Polkadot Identity LOC", async() => {
        const request = await repository.getNonVoidIdentityLoc(
            ValidAccountId.polkadot("5CXLTF2PFBE89tTYsrofGPkSfGTdmW4ciw4vAfgcKhjggRgZ"),
            ValidAccountId.polkadot("5CfbMJ9iLy1yQgGUdS6sR3gHBBhrAk9cbwxpY5vXcp9jsY4z"),
        );
        expect(request).not.toBeDefined();
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
        await service.deleteDraftRejectedOrAccepted(id, async () => {});
        await checkAggregate(id, 0)
    })

    it("deletes a rejected LocRequest aggregate", async () => {
        const id = uuid()
        const locRequest = givenLoc(id, "Transaction", "DRAFT")
        locRequest.submit();
        locRequest.reject("Because", moment());
        await service.addNewRequest(locRequest);
        await service.deleteDraftRejectedOrAccepted(id, async () => {});
        await checkAggregate(id, 0);
    })

    it("updates file", async () => {
        const id = uuid();
        const locRequest = givenLoc(id, "Collection", "OPEN");
        await service.addNewRequest(locRequest);
        await service.update(id, async request => {
            request.setFileRestrictedDelivery({
                hash,
                restrictedDelivery: true,
            });
        });
        const updatedRequest = await repository.findById(id);
        expect(updatedRequest?.files![0].restrictedDelivery).toBe(true);
    })

    it("pre-voids then cancel pre-void", async() => {
        const id = uuid();
        const locRequest = givenLoc(id, "Collection", "OPEN");
        await service.addNewRequest(locRequest);
        await service.update(id, async request => {
            request.preVoid(VOID_REASON);
        });
        let updatedRequest = await repository.findById(id);
        expect(updatedRequest?.voidInfo?.reason).toEqual(VOID_REASON);

        await service.update(id, async request => {
            request.cancelPreVoid();
        });
        updatedRequest = await repository.findById(id);
        expect(updatedRequest?.voidInfo?.reason).toBeNull()

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
            expectedOwnerAddress: [ ALICE_ACCOUNT ],
            expectedStatuses: ["CLOSED", "OPEN", "REVIEW_REJECTED", "REVIEW_PENDING"]
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
    locRequest.requester = EmbeddableNullableAccountId.from(requester)
    locRequest.ownerAddress = BOB_ACCOUNT.getAddress(DB_SS58_PREFIX);
    locRequest.description = "I want to open a case"
    locRequest.locType = locType
    locRequest.createdOn = moment().toISOString()
    locRequest.status = status
    locRequest.fees = new EmbeddableLocFees()
    locRequest.fees.legalFee = "42"
    if(locType === "Collection") {
        locRequest.fees.valueFee = "42"
        locRequest.fees.collectionItemFee = "21"
        locRequest.fees.tokensRecordFee = "21"
    }

    locRequest.links = []
    locRequest.addLink({
        target: uuid(),
        nature: "link nature",
        submitter: SUBMITTER,
    }, "MANUAL_BY_USER")
    locRequest.files = []
    locRequest.addFile({
        name: "fileName",
        hash,
        cid: "123",
        contentType: "content/type",
        nature: "nature1",
        submitter: SUBMITTER,
        restrictedDelivery: false,
        size: 789,
    }, "MANUAL_BY_USER")
    locRequest.metadata = []
    locRequest.addMetadataItem({
        name: "itemName",
        value: "something valuable",
        submitter: SUBMITTER,
    }, "MANUAL_BY_USER")
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
const COLLECTION_WITH_PARAMS = "d0460773-5b63-4fba-be29-283f3cd5fe8f";
