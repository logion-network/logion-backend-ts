import { v4 as uuid } from "uuid";
import { ALICE, DEFAULT_LEGAL_OFFICER } from "../../helpers/addresses";
import moment, { Moment } from "moment";
import {
    LocRequestDescription,
    LocRequestFactory,
    LocRequestAggregateRoot,
    LocRequestStatus,
    FileDescription,
    MetadataItemDescription,
    LinkDescription,
    VoidInfo,
    LocType,
    LocRequestRepository
} from "../../../src/logion/model/locrequest.model";
import { UserIdentity } from "../../../src/logion/model/useridentity";
import { Mock, It } from "moq.ts";
import { PostalAddress } from "../../../src/logion/model/postaladdress";
import { Seal, PersonalInfoSealService, PublicSeal, LATEST_SEAL_VERSION } from "../../../src/logion/services/seal.service";
import { UUID } from "bson";

const SUBMITTER = "5DDGQertEH5qvKVXUmpT3KNGViCX582Qa2WWb8nGbkmkRHvw";

const PUBLIC_SEAL: PublicSeal = {
    hash: "0x48aedf4e08e46b24970d97db566bfa6668581cc2f37791bac0c9817a4508607a",
    version: 0,
}

const SEAL: Seal = {
    ...PUBLIC_SEAL,
    salt: "4bdc2a75-5363-4bc0-a71c-41a5781df07c",
}

describe("LocRequestFactory", () => {

    const userIdentity: UserIdentity = {
        firstName: "Scott",
        lastName: "Tiger",
        email: "scott@logion.network",
        phoneNumber: "+789",
    };

    it("creates Transaction LOC request", async () => {
        givenRequestId(uuid());
        const description = createDescription('Transaction', "5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW");
        givenLocDescription(description);
        await whenCreatingLocRequest(false);
        thenRequestCreatedWithDescription(description);
        thenStatusIs("REQUESTED");
    });

    it("creates an open Transaction LOC with requester address", async () => {
        givenRequestId(uuid());
        const description = createDescription('Transaction', "5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW");
        givenLocDescription(description);
        await whenCreatingOpenLoc();
        thenOpenLocCreatedWithDescription(description)
    });

    it("creates an open Transaction LOC with requester id loc", async () => {
        givenRequestId(uuid());
        const requesterIdentityLocId = uuid().toString();
        const description = createDescription('Transaction', undefined, requesterIdentityLocId);
        const requesterIdentityLoc = new Mock<LocRequestAggregateRoot>();
        requesterIdentityLoc.setup(instance => instance.id).returns(requesterIdentityLocId);
        repository.setup(instance => instance.findById(requesterIdentityLocId)).returns(Promise.resolve(requesterIdentityLoc.object()));
        givenLocDescription(description);
        await whenCreatingOpenLoc();
        thenOpenLocCreatedWithDescription(description)
    });

    it("fails to create an open Transaction LOC with 2 requesters", async () => {
        givenRequestId(uuid());
        const description = createDescription('Transaction', "5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW", uuid().toString());
        givenLocDescription(description);
        await expectAsyncToThrow(whenCreatingOpenLoc);
    });

    it("fails to create an open Transaction LOC with no requester", async () => {
        givenRequestId(uuid());
        const description = createDescription('Transaction');
        givenLocDescription(description);
        await expectAsyncToThrow(whenCreatingOpenLoc);
    });

    it("creates Collection LOC request", async () => {
        givenRequestId(uuid());
        const description = createDescription('Collection', "5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW");
        givenLocDescription(description);
        await whenCreatingLocRequest(false);
        thenRequestCreatedWithDescription(description);
        thenStatusIs("REQUESTED");
    });

    it("creates an open Collection LOC with requester address", async () => {
        givenRequestId(uuid());
        const description = createDescription('Collection', "5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW");
        givenLocDescription(description);
        await whenCreatingOpenLoc();
        thenOpenLocCreatedWithDescription(description)
    });

    it("creates an open Collection LOC with requester id loc", async () => {
        givenRequestId(uuid());
        const requesterIdentityLocId = uuid().toString();
        const description = createDescription('Collection', undefined, requesterIdentityLocId);
        const requesterIdentityLoc = new Mock<LocRequestAggregateRoot>();
        requesterIdentityLoc.setup(instance => instance.id).returns(requesterIdentityLocId);
        repository.setup(instance => instance.findById(requesterIdentityLocId)).returns(Promise.resolve(requesterIdentityLoc.object()));
        givenLocDescription(description);
        await whenCreatingOpenLoc();
        thenOpenLocCreatedWithDescription(description)
    });

    it("fails to create an open Collection LOC with 2 requesters", async () => {
        givenRequestId(uuid());
        const description = createDescription('Collection', "5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW", uuid().toString());
        givenLocDescription(description);
        await expectAsyncToThrow(whenCreatingOpenLoc);
    });

    it("fails to create an open Collection LOC with no requester", async () => {
        givenRequestId(uuid());
        const description = createDescription('Collection');
        givenLocDescription(description);
        await expectAsyncToThrow(whenCreatingOpenLoc);
    });

    it("creates Identity LOC", async () => {
        givenRequestId(uuid());
        const description = createDescription('Identity', "5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW", undefined, undefined, undefined, PUBLIC_SEAL);
        givenLocDescription(description);
        await whenCreatingOpenLoc();
        thenOpenLocCreatedWithDescription(description);
    });

    it("creates Identity LOC request", async () => {
        givenRequestId(uuid());
        const userPostalAddress: PostalAddress = {
            line1: "Rue de la Paix",
            line2: "",
            postalCode: "4000",
            city: "Liège",
            country: "Belgium"
        }
        const description = createDescription('Identity', "5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW", undefined, userIdentity, userPostalAddress, PUBLIC_SEAL);
        givenLocDescription(description);
        await whenCreatingLocRequest(false);
        thenRequestCreatedWithDescription(description);
        thenRequestSealIs(SEAL);
        expect(description.userIdentity).toEqual(userIdentity)
        expect(description.userPostalAddress).toEqual(userPostalAddress)
        thenStatusIs("REQUESTED");
    });

    it("creates an open Identity LOC with requester address", async () => {
        givenRequestId(uuid());
        const description = createDescription('Identity', "5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW", undefined, undefined, undefined, PUBLIC_SEAL);
        givenLocDescription(description);
        await whenCreatingOpenLoc();
        thenOpenLocCreatedWithDescription(description)
    });

    it("fails to create an open Identity LOC with requester id loc", async () => {
        givenRequestId(uuid());
        const description = createDescription('Identity', undefined, uuid().toString());
        givenLocDescription(description);
        await expectAsyncToThrow(whenCreatingOpenLoc);
    });

    it("fails to create an open Identity LOC with 2 requesters", async () => {
        givenRequestId(uuid());
        const description = createDescription('Identity', "5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW", uuid().toString());
        givenLocDescription(description);
        await expectAsyncToThrow(whenCreatingOpenLoc);
    });

    it("creates an open Identity LOC with no requester", async () => {
        givenRequestId(uuid());
        const description = createDescription('Identity', undefined, undefined, userIdentity);
        givenLocDescription(description);
        await whenCreatingOpenLoc();
    });

    it("fails to create an open Identity LOC with no requester when identity is missing", async () => {
        givenRequestId(uuid());
        const description = createDescription('Identity');
        givenLocDescription(description);
        await expectAsyncToThrow(whenCreatingOpenLoc);
    });

    it("creates SOF LOC request", async () => {
        givenRequestId(uuid());
        const description = createDescription('Transaction', "5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW");
        givenLocDescription(description);
        const target = "target-loc"
        const nature = "Original LOC"
        await whenCreatingSofRequest(target, nature);
        thenRequestCreatedWithDescription(description);
        expect(request.links?.length).toBe(1)
        expect(request.links![0].target).toEqual(target)
        expect(request.links![0].nature).toEqual(nature)
    });

    it("creates a draft request", async () => {
        givenRequestId(uuid());
        const description = createDescription('Transaction', "5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW");
        givenLocDescription(description);
        await whenCreatingLocRequest(true);
        thenStatusIs("DRAFT");
    });

    function createDescription(locType: LocType, requesterAddress?: string, requesterIdentityLoc?: string, userIdentity?: UserIdentity, userPostalAddress?: PostalAddress, seal?: PublicSeal): LocRequestDescription {
        return {
            requesterAddress,
            requesterIdentityLoc,
            ownerAddress: ALICE,
            description: "Mrs ALice, I want to sell my last art work",
            createdOn: moment().toISOString(),
            userIdentity,
            userPostalAddress,
            locType,
            seal,
            company: undefined,
        };
    }
});

describe("LocRequestAggregateRoot", () => {

    it("rejects requested", () => {
        givenRequestWithStatus('REQUESTED');
        whenRejecting(REJECT_REASON, REJECTED_ON);
        thenRequestStatusIs('REJECTED');
        thenRequestRejectReasonIs(REJECT_REASON);
        thenDecisionOnIs(REJECTED_ON);
    });

    it("accepts requested", () => {
        givenRequestWithStatus('REQUESTED');
        whenAccepting(ACCEPTED_ON);
        thenRequestStatusIs('OPEN');
        thenRequestRejectReasonIs(undefined);
        thenDecisionOnIs(ACCEPTED_ON);
    });

    it("fails reject given already open", () => {
        givenRequestWithStatus('OPEN');
        expect(() => whenRejecting(REJECT_REASON, REJECTED_ON)).toThrowError();
    });

    it("fails accept given already open", () => {
        givenRequestWithStatus('OPEN');
        expect(() => whenAccepting(ACCEPTED_ON)).toThrowError();
    });

    it("fails reject given already rejected", () => {
        givenRequestWithStatus('REJECTED');
        expect(() => whenRejecting(REJECT_REASON, REJECTED_ON)).toThrowError();
    });

    it("fails accept given already rejected", () => {
        givenRequestWithStatus('REJECTED');
        expect(() => whenAccepting(ACCEPTED_ON)).toThrowError();
    });

    it("sets LOC created date", () => {
        givenRequestWithStatus('OPEN');
        const locCreatedDate = moment();
        whenSettingLocCreatedDate(locCreatedDate);
        thenExposesLocCreatedDate(locCreatedDate);
    });

    it("pre-closes", () => {
        givenRequestWithStatus('OPEN');
        whenPreClosing();
        thenRequestStatusIs('CLOSED');
    });

    it("closes", () => {
        givenRequestWithStatus('CLOSED');
        const closingDate = moment();
        whenClosing(closingDate);
        thenClosingDateIs(closingDate);
    });

    it("pre-voids when OPEN", () => {
        givenRequestWithStatus('OPEN');
        whenPreVoiding("reason");
        thenRequestStatusIs('OPEN');
        thenVoidInfoIs({
            reason: "reason",
            voidedOn: null
        })
    });

    it("pre-voids when CLOSED", () => {
        givenRequestWithStatus('CLOSED');
        whenPreVoiding("reason");
        thenRequestStatusIs('CLOSED');
        thenVoidInfoIs({
            reason: "reason",
            voidedOn: null
        })
    });

    it("voids when OPEN", () => {
        givenRequestWithStatus('OPEN');
        const voidingDate = moment();
        whenVoiding("reason", voidingDate);
        thenVoidInfoIs({
            reason: "reason",
            voidedOn: voidingDate
        })
    });

    it("voids when CLOSED", () => {
        givenRequestWithStatus('CLOSED');
        const voidingDate = moment();
        whenVoiding("reason", voidingDate);
        thenVoidInfoIs({
            reason: "reason",
            voidedOn: voidingDate
        })
    });

    it("accepts if pending when setting creation date", () => {
        givenRequestWithStatus('REQUESTED');
        const locCreatedDate = moment();
        whenSettingLocCreatedDate(locCreatedDate);
        thenStatusIs('OPEN');
    });

    it("submits if draft", () => {
        givenRequestWithStatus('DRAFT');
        whenSubmitting();
        thenRequestStatusIs('REQUESTED');
    });

    it("fails submit given non-draft", () => {
        givenRequestWithStatus('REQUESTED');
        expect(() => whenSubmitting()).toThrowError();
    });
});

describe("LocRequestAggregateRoot (metadata)", () => {

    it("does not accept several metadata items with same name", () => {
        givenRequestWithStatus('OPEN');
        const items: MetadataItemDescription[] = [
            {
                name: "same name",
                value: "some value",
                submitter: SUBMITTER,
            },
            {
                name: "same name",
                value: "some other value",
                submitter: SUBMITTER,
            }
        ];
        expect(() => whenAddingMetadata(items)).toThrowError();
    });

    it("adds and exposes metadata", () => {
        givenRequestWithStatus('OPEN');
        const metadata: MetadataItemDescription[] = [
            {
                name: "name1",
                value: "value1",
                submitter: SUBMITTER,
            },
            {
                name: "name2",
                value: "value2",
                submitter: SUBMITTER,
            }
        ];
        whenAddingMetadata(metadata);
        thenExposesMetadata(metadata);
    });

    it("submitter removes previously added metadata item", () => testRemovesItem(SUBMITTER));

    function testRemovesItem(remover: string) {
        givenRequestWithStatus('OPEN');
        const items: MetadataItemDescription[] = [
            {
                name: "name1",
                value: "some nice value",
                submitter: SUBMITTER,
            },
            {
                name: "name2",
                value: "some other nice value",
                submitter: SUBMITTER,
            }
        ];
        whenAddingMetadata(items);
        whenRemovingMetadataItem(remover, "name2")

        const newItems: MetadataItemDescription[] = [
            {
                name: "name1",
                value: "some nice value",
                submitter: SUBMITTER,
            }
        ];
        thenExposesMetadata(newItems);
        thenExposesMetadataItemByName("name1", newItems[0]);
        thenHasMetadataItem("name1");
        thenHasExpectedMetadataIndices();
    }

    it("owner removes previously added metadata item", () => testRemovesItem(OWNER));

    it("confirms metadata item", () => {
        givenRequestWithStatus('OPEN');
        const name = "target-1";
        whenAddingMetadata([
            {
                name,
                value: "value-1",
                submitter: SUBMITTER,
            }
        ])
        whenConfirmingMetadataItem(name)
        thenMetadataItemIsNotDraft(name)
        thenMetadataItemRequiresUpdate(name)
    })
})

describe("LocRequestAggregateRoot (links)", () => {

    it("does not accept several links with same target", () => {
        givenRequestWithStatus('OPEN');
        const links: LinkDescription[] = [
            {
                target: "another-loc-id",
                nature: "nature1"
            },
            {
                target: "another-loc-id",
                nature: "nature2"
            }
        ];
        expect(() => whenAddingLinks(links)).toThrowError();
    });

    it("adds and exposes links", () => {
        givenRequestWithStatus('OPEN');
        const links: LinkDescription[] = [
            {
                target: "value1",
                nature: "nature1",
            },
            {
                target: "value2",
                nature: "nature2",
            }
        ];
        whenAddingLinks(links);
        thenExposesLinks(links);
    });

    it("owner removes previously added link", () => {
        givenRequestWithStatus('OPEN');
        const links: LinkDescription[] = [
            {
                target: "target-1",
                nature: "nature-1"
            },
            {
                target: "target-2",
                nature: "nature-2"
            }
        ];
        whenAddingLinks(links);
        whenRemovingLink(OWNER, "target-1")

        const newLinks: LinkDescription[] = [
            {
                target: "target-2",
                nature: "nature-2"
            }
        ];
        thenExposesLinks(newLinks);
        thenExposesLinkByTarget("target-2", newLinks[0]);
        thenHasLink("target-2");
        thenHasExpectedLinkIndices();
    });

    it("cannot remove link if not owner", () => {
        givenRequestWithStatus('OPEN');
        const links: LinkDescription[] = [
            {
                target: "target-1",
                nature: "nature-1"
            },
            {
                target: "target-2",
                nature: "nature-2"
            }
        ];
        whenAddingLinks(links);
        expect(() => whenRemovingLink(SUBMITTER, "target-1")).toThrowError();
    });

    it("confirms link", () => {
        givenRequestWithStatus('OPEN');
        const target = "target-1";
        whenAddingLinks([
            {
                target,
                nature: "nature-1"
            }
        ])
        whenConfirmingLink(target)
        thenLinkIsNotDraft(target)
        thenLinkRequiresUpdate(target)
    })
})

describe("LocRequestAggregateRoot (files)", () => {

    it("adds and exposes files", () => {
        givenRequestWithStatus('OPEN');
        const files: FileDescription[] = [
            {
                hash: "hash1",
                name: "name1",
                contentType: "text/plain",
                cid: "cid-1234",
                nature: "nature1",
                submitter: SUBMITTER,
            },
            {
                hash: "hash2",
                name: "name2",
                contentType: "text/plain",
                cid: "cid-4567",
                nature: "nature2",
                submitter: SUBMITTER,
            }
        ];
        whenAddingFiles(files);
        thenExposesFiles(files);
        thenExposesFileByHash("hash1", files[0]);
        thenExposesFileByHash("hash2", files[1]);
        thenHasFile("hash1");
        thenHasFile("hash2");
    });

    it("does not accept several files with same hash", () => {
        givenRequestWithStatus('OPEN');
        const files: FileDescription[] = [
            {
                hash: "hash1",
                name: "name1",
                contentType: "text/plain",
                oid: 1234,
                nature: "nature1",
                submitter: SUBMITTER,
            },
            {
                hash: "hash1",
                name: "name2",
                contentType: "text/plain",
                oid: 4567,
                nature: "nature2",
                submitter: SUBMITTER,
            }
        ];
        expect(() => whenAddingFiles(files)).toThrowError();
    });

    it("submitter removes previously added files", () => testRemovesFile(SUBMITTER));

    function testRemovesFile(remover: string) {
        givenRequestWithStatus('OPEN');
        const files: FileDescription[] = [
            {
                hash: "hash1",
                name: "name1",
                contentType: "text/plain",
                cid: "cid-1234",
                nature: "nature1",
                submitter: SUBMITTER,
            },
            {
                hash: "hash2",
                name: "name2",
                contentType: "text/plain",
                cid: "cid-4567",
                nature: "nature2",
                submitter: SUBMITTER,
            }
        ];
        whenAddingFiles(files);
        whenRemovingFile(remover, "hash1");
        thenReturnedRemovedFile(files[0]);

        const newFiles: FileDescription[] = [
            {
                hash: "hash2",
                name: "name2",
                contentType: "text/plain",
                cid: "cid-4567",
                nature: "nature2",
                submitter: SUBMITTER,
            }
        ];
        thenExposesFiles(newFiles);
        thenExposesFileByHash("hash2", newFiles[0]);
        thenHasFile("hash2");
        thenHasExpectedFileIndices();
    }

    it("owner removes previously added files", () => testRemovesFile(OWNER));

    it("confirms file", () => {
        givenRequestWithStatus('OPEN');
        const hash = "hash-1";
        whenAddingFiles([
            {
                hash,
                name: "name1",
                contentType: "text/plain",
                cid: "cid-1234",
                nature: "nature1",
                submitter: SUBMITTER,
            }
        ]);
        whenConfirmingFile(hash)
        thenFileIsNotDraft(hash)
        thenFileRequiresUpdate(hash)
    })
})

describe("LocRequestAggregateRoot (synchronization)", () => {

    it("sets metadata item timestamp", () => {
        givenRequestWithStatus("OPEN")
        whenAddingMetadata([{
            name: "data-1",
            value: "value-1",
            submitter: SUBMITTER,
        }])
        const addedOn = moment();
        whenSettingMetadataItemAddedOn("data-1", addedOn);
        thenMetadataItemIsNotDraft("data-1")
        thenMetadataItemRequiresUpdate("data-1")
        thenExposesMetadataItemByName("data-1", {
            name: "data-1",
            value: "value-1",
            submitter: SUBMITTER,
            addedOn: addedOn
        })
    })

    it("sets link timestamp", () => {
        givenRequestWithStatus("OPEN")
        whenAddingLinks([{
            target: "target-1",
            nature: "nature-1",
        }])
        const addedOn = moment();
        whenSettingLinkAddedOn("target-1", addedOn);
        thenLinkIsNotDraft("target-1")
        thenLinkRequiresUpdate("target-1")
        thenExposesLinkByTarget("target-1", {
            target: "target-1",
            nature: "nature-1",
            addedOn: addedOn
        })
    })

    it("sets file timestamp", () => {
        givenRequestWithStatus("OPEN")
        const files: FileDescription[] = [
            {
                hash: "hash1",
                name: "name1",
                contentType: "text/plain",
                cid: "cid-1234",
                nature: "nature1",
                submitter: SUBMITTER,
            },
            {
                hash: "hash2",
                name: "name2",
                contentType: "text/plain",
                cid: "cid-4567",
                nature: "nature2",
                submitter: SUBMITTER,
            }
        ];
        whenAddingFiles(files);
        const addedOn = moment();
        whenSettingFileAddedOn("hash1", addedOn);
        thenFileIsNotDraft("hash1")
        thenFileRequiresUpdate("hash1")
        thenExposesFileByHash("hash1", {
            hash: "hash1",
            name: "name1",
            contentType: "text/plain",
            cid: "cid-1234",
            nature: "nature1",
            submitter: SUBMITTER,
            addedOn: addedOn
        })
    })
})

describe("LocRequestAggregateRoot (processes)", () => {

    it("full life-cycle", () => {
        // User creates and submits
        givenRequestWithStatus("DRAFT");

        request.addFile({
            hash: "hash1",
            name: "name1",
            contentType: "text/plain",
            oid: 1234,
            nature: "nature1",
            submitter: SUBMITTER,
        });
        const target1 = new UUID().toString();
        request.addLink({
            nature: "Some link nature",
            target: target1,
        });
        request.addMetadataItem({
            name: "Some name",
            value: "Some value",
            submitter: SUBMITTER,
        });
        request.submit();
        thenRequestStatusIs("REQUESTED");

        // LLO accepts and publishes
        request.accept(moment());
        thenRequestStatusIs("OPEN");

        request.confirmFile("hash1");
        request.setFileAddedOn("hash1", moment()); // Sync

        request.confirmLink(target1);
        request.setLinkAddedOn(target1, moment()); // Sync

        request.confirmMetadataItem("Some name");
        request.setMetadataItemAddedOn("Some name", moment()); // Sync

        // LLO adds other data
        request.addFile({
            hash: "hash2",
            name: "name2",
            contentType: "text/plain",
            oid: 1235,
            nature: "nature2",
            submitter: OWNER,
        });
        request.confirmFile("hash2");
        request.setFileAddedOn("hash2", moment()); // Sync

        const target2 = new UUID().toString();
        request.addLink({
            nature: "Some other link nature",
            target: target2,
        });
        request.confirmLink(target2);
        request.setLinkAddedOn(target2, moment()); // Sync

        request.addMetadataItem({
            name: "Some other name",
            value: "Some other value",
            submitter: OWNER,
        });
        request.confirmMetadataItem("Some other name");
        request.setMetadataItemAddedOn("Some other name", moment()); // Sync

        // LLO closes
        request.preClose();
        thenRequestStatusIs("CLOSED");
        request.close(moment()); // Sync

        // LLO voids
        request.preVoid("Void reason");
        request.voidLoc(moment()); // Sync
    })
})

const REJECT_REASON = "Illegal";
const REJECTED_ON = moment();
const ACCEPTED_ON = moment().add(1, "minute");

function givenRequestWithStatus(status: LocRequestStatus) {
    request = new LocRequestAggregateRoot();
    request.status = status;
    request.files = [];
    request.metadata = [];
    request.links = [];
    request.ownerAddress = OWNER;
    request.requesterAddress = SUBMITTER;
}

const OWNER = DEFAULT_LEGAL_OFFICER;

let request: LocRequestAggregateRoot;

function whenRejecting(rejectReason: string, rejectedOn: Moment) {
    request.reject(rejectReason, rejectedOn);
}

function whenAccepting(acceptedOn: Moment) {
    request.accept(acceptedOn);
}

function thenRequestStatusIs(expectedStatus: LocRequestStatus) {
    expect(request.status).toBe(expectedStatus);
}

function thenRequestSealIs(expectedSeal: Seal) {
    expect(request.seal?.hash).toEqual(expectedSeal.hash);
    expect(request.seal?.salt).toEqual(expectedSeal.salt);
}

function thenRequestRejectReasonIs(rejectReason: string | undefined) {
    expect(request.rejectReason).toBe(rejectReason);
}

function thenDecisionOnIs(rejectedOn: Moment) {
    expect(request.decisionOn).toEqual(rejectedOn.toISOString());
}

function givenRequestId(value: string) {
    requestId = value;
}

let requestId: string;

function givenLocDescription(value: LocRequestDescription) {
    locDescription = value;
}

let locDescription: LocRequestDescription;

async function whenCreatingLocRequest(draft: boolean) {
    const sealService = new Mock<PersonalInfoSealService>();
    sealService
        .setup(instance => instance.seal(It.IsAny<UserIdentity>(), LATEST_SEAL_VERSION))
        .returns(SEAL);
    const factory = new LocRequestFactory(repository.object(), sealService.object());
    request = await factory.newLocRequest({
        id: requestId,
        description: locDescription,
        draft,
    });
}

async function whenCreatingSofRequest(target: string, nature: string) {
    const sealService = new Mock<PersonalInfoSealService>();
    const factory = new LocRequestFactory(repository.object(), sealService.object());
    request = await factory.newSofRequest({
        id: requestId,
        description: locDescription,
        target,
        nature
    });
}

async function whenCreatingOpenLoc() {
    const sealService = new Mock<PersonalInfoSealService>();
    sealService
        .setup(instance => instance.seal(It.IsAny(), LATEST_SEAL_VERSION))
        .returns(SEAL);
    const factory = new LocRequestFactory(repository.object(), sealService.object());
    request = await factory.newOpenLoc({
        id: requestId,
        description: locDescription
    });
}

const repository = new Mock<LocRequestRepository>();

function thenRequestCreatedWithDescription(description: LocRequestDescription) {
    expect(request.id).toBe(requestId);
    expect(request.status).toBe('REQUESTED');
    expect(request.getDescription()).toEqual(description);
    expect(request.decisionOn).toBeUndefined();
}

function thenOpenLocCreatedWithDescription(description: LocRequestDescription) {
    expect(request.id).toBe(requestId);
    expect(request.status).toBe('OPEN');
    expect(request.getDescription()).toEqual(description);
    expect(request.decisionOn).toBeDefined();
}

function whenAddingFiles(files: FileDescription[]) {
    files.forEach(file => request.addFile(file));
}

function thenExposesFiles(expectedFiles: FileDescription[]) {
    request.getFiles().forEach((file, index) => {
        expectSameFiles(file, expectedFiles[index]);
    });
}

function expectSameFiles(f1: FileDescription, f2: FileDescription) {
    expect(f1.hash).toEqual(f2.hash);
    expect(f1.name).toEqual(f2.name);
    expect(f1.oid).toEqual(f2.oid);
    expect(f1.contentType).toEqual(f2.contentType);
    expect(f1.nature).toEqual(f2.nature);
    expect(f1.submitter).toEqual(f2.submitter);
    if(f1.addedOn === undefined) {
        expect(f2.addedOn).not.toBeDefined();
    } else {
        expect(f1.addedOn.isSame(f2.addedOn!)).toBe(true);
    }
}

function thenExposesFileByHash(hash: string, expectedFile: FileDescription) {
    expectSameFiles(request.getFile(hash), expectedFile);
}

function thenHasFile(hash: string) {
    expect(request.hasFile(hash)).toBe(true);
}

function whenAddingMetadata(metadata: MetadataItemDescription[]) {
    metadata.forEach(item => request.addMetadataItem(item));
}

function thenExposesMetadata(expectedMetadata: MetadataItemDescription[]) {
    request.getMetadataItems().forEach((item, index) => {
        expect(item.name).toBe(expectedMetadata[index].name);
        expect(item.value).toBe(expectedMetadata[index].value);
        expect(item.submitter).toBe(expectedMetadata[index].submitter);
        if (item.addedOn === undefined) {
            expect(expectedMetadata[index].addedOn).not.toBeDefined()
        } else {
            expect(item.addedOn.isSame(expectedMetadata[index].addedOn)).toBe(true);
        }
    });
}

function thenExposesMetadataItemByName(name: string, expectedMetadataItem: MetadataItemDescription) {
    expectSameMetadataItems(request.getMetadataItem(name), expectedMetadataItem)
}

function expectSameMetadataItems(item1: MetadataItemDescription, item2: MetadataItemDescription) {
    expect(item1.name).toEqual(item2.name);
    expect(item1.value).toEqual(item2.value);
    expect(item1.submitter).toEqual(item2.submitter);
    if (item1.addedOn === undefined) {
        expect(item2.addedOn).toBeUndefined()
    } else {
        expect(item1.addedOn.isSame(item2.addedOn)).toBeTrue()
    }
}

function thenHasMetadataItem(name: string) {
    expect(request.hasMetadataItem(name)).toBeTrue();
}

function thenHasExpectedMetadataIndices() {
    for(let i = 0; i < request.metadata!.length; ++i) {
        expect(request.metadata![i].index).toBe(i);
    }
}

function whenSettingMetadataItemAddedOn(name: string, addedOn:Moment) {
    request.setMetadataItemAddedOn(name, addedOn);
}

function whenConfirmingMetadataItem(name: string) {
    request.confirmMetadataItem(name);
}

function thenMetadataItemIsNotDraft(name: string) {
    expect(request.metadataItem(name)?.draft).toBeFalse();
}

function thenMetadataItemRequiresUpdate(name: string) {
    expect(request.metadataItem(name)?._toUpdate).toBeTrue();
}

function whenSettingFileAddedOn(hash: string, addedOn:Moment) {
    request.setFileAddedOn(hash, addedOn);
}

function whenConfirmingFile(hash: string) {
    request.confirmFile(hash);
}

function thenFileIsNotDraft(hash: string) {
    expect(request.file(hash)?.draft).toBeFalse();
}

function thenFileRequiresUpdate(hash: string) {
    expect(request.file(hash)?._toUpdate).toBeTrue();
}

function whenSettingLinkAddedOn(target: string, addedOn:Moment) {
    request.setLinkAddedOn(target, addedOn);
}

function whenConfirmingLink(target: string) {
    request.confirmLink(target);
}

function thenLinkIsNotDraft(target: string) {
    expect(request.link(target)?.draft).toBeFalse();
}

function thenLinkRequiresUpdate(target: string) {
    expect(request.link(target)?._toUpdate).toBeTrue();
}

function whenSettingLocCreatedDate(locCreatedDate: Moment) {
    request.setLocCreatedDate(locCreatedDate);
}

function thenExposesLocCreatedDate(expectedDate: Moment) {
    expect(request.getLocCreatedDate().isSame(expectedDate)).toBe(true);
}

function whenRemovingMetadataItem(remover: string, name: string) {
    request.removeMetadataItem(remover, name);
}

function whenRemovingLink(remover: string, target: string) {
    request.removeLink(remover, target);
}

function whenRemovingFile(remover: string, hash: string) {
    removedFile = request.removeFile(remover, hash);
}

let removedFile: FileDescription;

function whenSubmitting() {
    request.submit();
}

function thenReturnedRemovedFile(expectedFile: FileDescription) {
    expectSameFiles(removedFile, expectedFile);
}

function thenHasExpectedFileIndices() {
    for(let i = 0; i < request.files!.length; ++i) {
        expect(request.files![i].index).toBe(i);
    }
}

function whenAddingLinks(links: LinkDescription[]) {
    links.forEach(link => request.addLink(link));
}

function thenExposesLinks(expectedLinks: LinkDescription[]) {
    request.getLinks().forEach((link, index) => {
        expect(link.target).toBe(expectedLinks[index].target);
        expect(link.nature).toBe(expectedLinks[index].nature);
        if (link.addedOn === undefined) {
            expect(expectedLinks[index].addedOn).not.toBeDefined()
        } else {
            expect(link.addedOn.isSame(expectedLinks[index].addedOn)).toBe(true);
        }
    });
}

function thenExposesLinkByTarget(target: string, expectedLink: LinkDescription) {
    expectSameLinks(request.getLink(target), expectedLink)
}

function expectSameLinks(item1: LinkDescription, item2: LinkDescription) {
    expect(item1.target).toEqual(item2.target);
    expect(item1.nature).toEqual(item2.nature);
    if (item1.addedOn === undefined) {
        expect(item2.addedOn).toBeUndefined()
    } else {
        expect(item1.addedOn.isSame(item2.addedOn)).toBeTrue()
    }
}

function thenHasLink(name: string) {
    expect(request.hasLink(name)).toBeTrue();
}

function thenHasExpectedLinkIndices() {
    for(let i = 0; i < request.links!.length; ++i) {
        expect(request.links![i].index).toBe(i);
    }
}

function whenPreClosing() {
    request.preClose();
}

function whenPreVoiding(reason: string) {
    request.preVoid(reason);
}

function thenVoidInfoIs(expected: VoidInfo) {
    const voidInfo = request.getVoidInfo();
    expect(voidInfo).toBeDefined();
    expect(voidInfo!.reason).toEqual(expected.reason);
    if(expected.voidedOn !== null) {
        expect(voidInfo!.voidedOn).toBeDefined();
        expect(voidInfo!.voidedOn!.isSame(expected.voidedOn)).toBe(true);
    } else {
        expect(voidInfo!.voidedOn).toBeNull();
    }
}

function whenClosing(date: Moment) {
    request.close(date);
}

function thenClosingDateIs(expected: Moment) {
    expect(request.getClosedOn()!.isSame(expected)).toBe(true);
}

function whenVoiding(reason: string, voidingDate: Moment) {
    request.preVoid(reason);
    request.voidLoc(voidingDate);
}

async function expectAsyncToThrow(func: () => Promise<void>) {
    try {
        await func();
        expect(true).toBe(false);
    } catch(_) {}
}

function thenStatusIs(expectedStatus: LocRequestStatus) {
    expect(request.status).toBe(expectedStatus);
}
