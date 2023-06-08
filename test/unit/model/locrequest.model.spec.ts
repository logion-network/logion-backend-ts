import { v4 as uuid } from "uuid";
import { ALICE, ALICE_ACCOUNT } from "../../helpers/addresses.js";
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
    LocRequestRepository,
    MetadataItemParams,
    ItemStatus, FileParams
} from "../../../src/logion/model/locrequest.model.js";
import { UserIdentity } from "../../../src/logion/model/useridentity.js";
import { Mock, It } from "moq.ts";
import { PostalAddress } from "../../../src/logion/model/postaladdress.js";
import { Seal, PersonalInfoSealService, PublicSeal, LATEST_SEAL_VERSION } from "../../../src/logion/services/seal.service.js";
import { UUID } from "@logion/node-api";
import { IdenfyVerificationSession, IdenfyVerificationStatus } from "src/logion/services/idenfy/idenfy.types.js";
import { SupportedAccountId } from "../../../src/logion/model/supportedaccountid.model.js";

const SUBMITTER: SupportedAccountId = {
    type: "Polkadot",
    address: "5DDGQertEH5qvKVXUmpT3KNGViCX582Qa2WWb8nGbkmkRHvw"
};

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
        thenStatusIs("REVIEW_PENDING");
    });

    it("creates an open Transaction LOC with requester address", async () => {
        givenRequestId(uuid());
        const description = createDescription('Transaction', "5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW");
        givenLocDescription(description);
        await whenCreatingOpenLoc();
        thenRequestCreatedWithDescription(description)
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
        thenRequestCreatedWithDescription(description)
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
        thenStatusIs("REVIEW_PENDING");
    });

    it("creates an open Collection LOC with requester address", async () => {
        givenRequestId(uuid());
        const description = createDescription('Collection', "5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW");
        givenLocDescription(description);
        await whenCreatingOpenLoc();
        thenRequestCreatedWithDescription(description)
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
        thenRequestCreatedWithDescription(description)
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
        thenRequestCreatedWithDescription(description);
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
        thenStatusIs("REVIEW_PENDING");
    });

    it("creates an open Identity LOC with requester address", async () => {
        givenRequestId(uuid());
        const description = createDescription('Identity', "5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW", undefined, undefined, undefined, PUBLIC_SEAL);
        givenLocDescription(description);
        await whenCreatingOpenLoc();
        thenRequestCreatedWithDescription(description)
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
        thenRequestCreatedWithDescription({
            ...description,
            template: "statement_of_facts"
        });
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
            requesterAddress: requesterAddress ? { type: "Polkadot", address: requesterAddress } : undefined,
            requesterIdentityLoc,
            ownerAddress: ALICE,
            description: "Mrs ALice, I want to sell my last art work",
            createdOn: moment().toISOString(),
            userIdentity,
            userPostalAddress,
            locType,
            seal,
            company: undefined,
            template: "some-template",
            sponsorshipId: new UUID(),
        };
    }
});

describe("LocRequestAggregateRoot", () => {

    it("rejects pending", () => {
        givenRequestWithStatus('REVIEW_PENDING');
        whenRejecting(REJECT_REASON, REJECTED_ON);
        thenRequestStatusIs('REVIEW_REJECTED');
        thenRequestRejectReasonIs(REJECT_REASON);
        thenDecisionOnIs(REJECTED_ON);
    });

    it("accepts pending", () => {
        givenRequestWithStatus('REVIEW_PENDING');
        whenAccepting(ACCEPTED_ON);
        thenRequestStatusIs('REVIEW_ACCEPTED');
        thenRequestRejectReasonIs(undefined);
        thenDecisionOnIs(ACCEPTED_ON);
    });

    it("opens an accepted request", () => {
        givenRequestWithStatus('REVIEW_ACCEPTED');
        whenOpening();
        thenRequestStatusIs('OPEN');
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
        givenRequestWithStatus('REVIEW_REJECTED');
        expect(() => whenRejecting(REJECT_REASON, REJECTED_ON)).toThrowError();
    });

    it("fails accept given already rejected", () => {
        givenRequestWithStatus('REVIEW_REJECTED');
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
        givenRequestWithStatus('REVIEW_ACCEPTED');
        const locCreatedDate = moment();
        whenSettingLocCreatedDate(locCreatedDate);
        thenStatusIs('OPEN');
    });

    it("submits if draft", () => {
        givenRequestWithStatus('DRAFT');
        whenSubmitting();
        thenRequestStatusIs('REVIEW_PENDING');
    });

    it("fails submit given non-draft", () => {
        givenRequestWithStatus('REVIEW_PENDING');
        expect(() => whenSubmitting()).toThrowError();
    });

    it("fails submit given ongoing iDenfy verification session", () => {
        givenRequestWithStatus('DRAFT');
        request.iDenfyVerification = {
            status: "PENDING",
        };
        expect(() => whenSubmitting()).toThrowError();
    });

    it("initiates iDenfy verification", () => {
        givenRequestWithStatus('DRAFT');
        const session: IdenfyVerificationSession = {
            authToken: "pgYQX0z2T8mtcpNj9I20uWVCLKNuG0vgr12f0wAC",
            scanRef: "3af0b5c9-8ef3-4815-8796-5ab3ed942917",
        };
        request.initIdenfyVerification(session);
        expect(request.iDenfyVerification?.authToken).toBe(session.authToken);
        expect(request.iDenfyVerification?.scanRef).toBe(session.scanRef);
        expect(request.iDenfyVerification?.callbackPayload).toBeUndefined();
        expect(request.iDenfyVerification?.status).toBe("PENDING");
    });

    it("updates iDenfy verification result", () => {
        givenRequestWithStatus('DRAFT');
        const session: IdenfyVerificationSession = {
            authToken: "pgYQX0z2T8mtcpNj9I20uWVCLKNuG0vgr12f0wAC",
            scanRef: "3af0b5c9-8ef3-4815-8796-5ab3ed942917",
        };
        request.initIdenfyVerification(session);
        const rawJson = idenfyCallbackPayload("APPROVED");
        const payload = JSON.parse(rawJson);

        request.updateIdenfyVerification(payload, rawJson);

        expect(request.iDenfyVerification?.authToken).toBe(session.authToken);
        expect(request.iDenfyVerification?.scanRef).toBe(session.scanRef);
        expect(request.iDenfyVerification?.callbackPayload).toBe(rawJson);
        expect(request.iDenfyVerification?.status).toBe("APPROVED");
    });

    it("fails updating iDenfy verification result if not initiated yet", () => {
        givenRequestWithStatus('DRAFT');
        const rawJson = idenfyCallbackPayload("APPROVED");
        const payload = JSON.parse(rawJson);
        expect(() => request.updateIdenfyVerification(payload, rawJson)).toThrowError("iDenfy verification was not initiated");
    });
});

function idenfyCallbackPayload(status: IdenfyVerificationStatus) {
    return `{
    "final": true,
    "status": {
        "overall": "${ status }"
    }
}`;
}

describe("LocRequestAggregateRoot (metadata)", () => {

    it("does not accept several metadata items with same name", () => {
        givenRequestWithStatus('OPEN');
        const items: MetadataItemParams[] = [
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
        expect(() => whenAddingMetadata(items, false)).toThrowError();
    });

    it("adds and exposes metadata", () => {
        givenRequestWithStatus('OPEN');
        const metadata: MetadataItemParams[] = [
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
        whenAddingMetadata(metadata, false);
        thenExposesMetadata(metadata);
    });

    it("submitter removes previously added metadata item", () => testRemovesItem(SUBMITTER));

    function testRemovesItem(remover: SupportedAccountId) {
        givenRequestWithStatus('OPEN');
        const items: MetadataItemParams[] = [
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
        whenAddingMetadata(items, false);
        whenRemovingMetadataItem(remover, "name2")

        const newItems: MetadataItemParams[] = [
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

    it("owner removes previously added metadata item", () => testRemovesItem(OWNER_ACCOUNT));

    it("confirms metadata item", () => {
        givenRequestWithStatus('OPEN');
        const name = "target-1";
        whenAddingMetadata([
            {
                name,
                value: "value-1",
                submitter: SUBMITTER,
            }
        ], true)
        whenConfirmingMetadataItem(name)
        thenMetadataItemStatusIs(name, "PUBLISHED")
        thenMetadataItemRequiresUpdate(name)
    })

    it("exposes draft, owner-submitted metadata to requester", () => {
        givenRequestWithStatus('OPEN');
        const name = "target-3";
        whenAddingMetadata([
            {
                name,
                value: "value-1",
                submitter: OWNER_ACCOUNT,
            }
        ], false)
        thenMetadataIsVisibleToRequester(name);
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
        whenRemovingLink(OWNER_ACCOUNT, "target-1")

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
        const files: FileParams[] = [
            {
                hash: "hash1",
                name: "name1",
                contentType: "text/plain",
                cid: "cid-1234",
                nature: "nature1",
                submitter: SUBMITTER,
                restrictedDelivery: false,
                size: 123,
            },
            {
                hash: "hash2",
                name: "name2",
                contentType: "text/plain",
                cid: "cid-4567",
                nature: "nature2",
                submitter: SUBMITTER,
                restrictedDelivery: false,
                size: 123,
            }
        ];
        whenAddingFiles(files, false);
        thenExposesFiles(files);
        thenExposesFileByHash("hash1", files[0]);
        thenExposesFileByHash("hash2", files[1]);
        thenHasFile("hash1");
        thenHasFile("hash2");
    });

    it("does not accept several files with same hash", () => {
        givenRequestWithStatus('OPEN');
        const files: FileParams[] = [
            {
                hash: "hash1",
                name: "name1",
                contentType: "text/plain",
                oid: 1234,
                nature: "nature1",
                submitter: SUBMITTER,
                restrictedDelivery: false,
                size: 123,
            },
            {
                hash: "hash1",
                name: "name2",
                contentType: "text/plain",
                oid: 4567,
                nature: "nature2",
                submitter: SUBMITTER,
                restrictedDelivery: false,
                size: 123,
            }
        ];
        expect(() => whenAddingFiles(files, false)).toThrowError();
    });

    it("submitter removes previously added files", () => testRemovesFile(SUBMITTER));

    function testRemovesFile(remover: SupportedAccountId) {
        givenRequestWithStatus('OPEN');
        const files: FileParams[] = [
            {
                hash: "hash1",
                name: "name1",
                contentType: "text/plain",
                cid: "cid-1234",
                nature: "nature1",
                submitter: SUBMITTER,
                restrictedDelivery: false,
                size: 123,
            },
            {
                hash: "hash2",
                name: "name2",
                contentType: "text/plain",
                cid: "cid-4567",
                nature: "nature2",
                submitter: SUBMITTER,
                restrictedDelivery: false,
                size: 123,
            }
        ];
        whenAddingFiles(files, false);
        whenRemovingFile(remover, "hash1");
        thenReturnedRemovedFile(files[0]);

        const newFiles: FileParams[] = [
            {
                hash: "hash2",
                name: "name2",
                contentType: "text/plain",
                cid: "cid-4567",
                nature: "nature2",
                submitter: SUBMITTER,
                restrictedDelivery: false,
                size: 123,
            }
        ];
        thenExposesFiles(newFiles);
        thenExposesFileByHash("hash2", newFiles[0]);
        thenHasFile("hash2");
        thenHasExpectedFileIndices();
    }

    it("owner removes previously added files", () => testRemovesFile(OWNER_ACCOUNT));

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
                restrictedDelivery: false,
                size: 123,
            }
        ], true);
        whenConfirmingFile(hash)
        thenFileStatusIs(hash, "PUBLISHED")
        thenFileRequiresUpdate(hash)
    })

    it("exposes draft, owner-submitted file to requester", () => {
        givenRequestWithStatus('OPEN');
        const hash = "hash-3";
        whenAddingFiles([
            {
                hash,
                name: "name1",
                contentType: "text/plain",
                cid: "cid-1234",
                nature: "nature1",
                submitter: OWNER_ACCOUNT,
                restrictedDelivery: false,
                size: 123,
            }
        ], true);
        thenFileIsVisibleToRequester(hash)
    })

    it("accepts delivered files with restricted delivery", () => {
        const hash = "hash-1";
        givenClosedCollectionLocWithFile(hash);

        const deliveredFileHash = "hash-2";
        request.addDeliveredFile({
            hash,
            deliveredFileHash,
            generatedOn: moment(),
            owner: OWNER,
        });

        const file = request.files?.find(file => file.hash === hash);
        expect(file?.delivered?.length).toBe(1);
        expect(file?.delivered![0].hash).toBe(hash);
        expect(file?.delivered![0].requestId).toBe(request.id);
        expect(file?.delivered![0].file).toBe(file);

        expect(file?.delivered![0].deliveredFileHash).toBe(deliveredFileHash);
        expect(file?.delivered![0].owner).toBe(OWNER);
        expect(file?.delivered![0].generatedOn).toBeDefined();

        expect(file?.delivered![0]._toAdd).toBe(true);
    })

    it("accepts delivered files with restricted delivery", () => {
        const hash = "hash-1";
        givenClosedCollectionLocWithFile(hash);

        const deliveredFileHash = "hash-2";
        request.addDeliveredFile({
            hash,
            deliveredFileHash,
            generatedOn: moment(),
            owner: OWNER,
        });

        const file = request.files?.find(file => file.hash === hash);
        expect(file?.delivered?.length).toBe(1);
        expect(file?.delivered![0].hash).toBe(hash);
        expect(file?.delivered![0].requestId).toBe(request.id);
        expect(file?.delivered![0].file).toBe(file);

        expect(file?.delivered![0].deliveredFileHash).toBe(deliveredFileHash);
        expect(file?.delivered![0].owner).toBe(OWNER);
        expect(file?.delivered![0].generatedOn).toBeDefined();

        expect(file?.delivered![0]._toAdd).toBe(true);
    })

    it("cannot add delivered file if not collection", () => {
        givenRequestWithStatus('CLOSED');
        request.locType = "Transaction";

        expect(() => request.addDeliveredFile({
            hash: "hash-1",
            deliveredFileHash: "hash-2",
            generatedOn: moment(),
            owner: OWNER,
        })).toThrowError("Restricted delivery is only available with Collection LOCs");
    })

    it("cannot add delivered file if not closed", () => {
        givenRequestWithStatus('OPEN');
        request.locType = "Collection";

        expect(() => request.addDeliveredFile({
            hash: "hash-1",
            deliveredFileHash: "hash-2",
            generatedOn: moment(),
            owner: OWNER,
        })).toThrowError("Restricted delivery is only possible with closed Collection LOCs");
    })

    it("cannot add delivered file if file not found", () => {
        givenRequestWithStatus('CLOSED');
        request.locType = "Collection";

        expect(() => request.addDeliveredFile({
            hash: "hash-1",
            deliveredFileHash: "hash-2",
            generatedOn: moment(),
            owner: OWNER,
        })).toThrowError("No file with hash hash-1");
    })

    it("updates file", () => {
        givenRequestWithStatus('OPEN');
        request.locType = "Collection";
        const file: FileParams = {
            hash: "hash1",
            name: "name1",
            contentType: "text/plain",
            cid: "cid-1234",
            nature: "nature1",
            submitter: SUBMITTER,
            restrictedDelivery: false,
            size: 123,
        };
        whenAddingFiles([ file ], false);
        whenUpdatingFile("hash1", false);
        thenExposesFileByHash("hash1", { ...file, restrictedDelivery: false });
        whenUpdatingFile("hash1", true);
        thenExposesFileByHash("hash1", { ...file, restrictedDelivery: true });
    });

    it("fails to update file for Identity LOC", () => {
        givenRequestWithStatus('OPEN');
        request.locType = "Identity";
        const file: FileParams = {
            hash: "hash1",
            name: "name1",
            contentType: "text/plain",
            cid: "cid-1234",
            nature: "nature1",
            submitter: SUBMITTER,
            restrictedDelivery: false,
            size: 123,
        };
        whenAddingFiles([ file ], false);
        expect(() => {
            whenUpdatingFile("hash1", true);
        }).toThrowError("Can change restricted delivery of file only on Collection LOC.");
    });

})

function givenClosedCollectionLocWithFile(hash: string) {
    givenRequestWithStatus('OPEN');
    request.locType = "Collection";
    request.addFile({
        hash,
        name: "name1",
        contentType: "text/plain",
        cid: "cid-1234",
        nature: "nature1",
        submitter: OWNER_ACCOUNT,
        restrictedDelivery: true,
        size: 123,
    }, true);
    request.close(moment());
}

describe("LocRequestAggregateRoot (synchronization)", () => {

    it("sets metadata item timestamp", () => {
        givenRequestWithStatus("OPEN")
        whenAddingMetadata([{
            name: "data-1",
            value: "value-1",
            submitter: SUBMITTER,
        }], true)
        const addedOn = moment();
        whenSettingMetadataItemAddedOn("data-1", addedOn);
        thenMetadataItemStatusIs("data-1", "PUBLISHED")
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
        const files: FileParams[] = [
            {
                hash: "hash1",
                name: "name1",
                contentType: "text/plain",
                cid: "cid-1234",
                nature: "nature1",
                submitter: SUBMITTER,
                restrictedDelivery: false,
                size: 123,
            },
            {
                hash: "hash2",
                name: "name2",
                contentType: "text/plain",
                cid: "cid-4567",
                nature: "nature2",
                submitter: SUBMITTER,
                restrictedDelivery: false,
                size: 123,
            }
        ];
        whenAddingFiles(files, true);
        const addedOn = moment();
        whenSettingFileAddedOn("hash1", addedOn);
        thenFileStatusIs("hash1", "PUBLISHED")
        thenFileRequiresUpdate("hash1")
        thenExposesFileByHash("hash1", {
            hash: "hash1",
            name: "name1",
            contentType: "text/plain",
            cid: "cid-1234",
            nature: "nature1",
            submitter: SUBMITTER,
            addedOn: addedOn,
            restrictedDelivery: false,
            size: 123,
        })
    })
})

describe("LocRequestAggregateRoot (processes)", () => {

    it("full life-cycle", () => {
        // User creates a draft
        givenRequestWithStatus("DRAFT");

        const fileHash = "hash1";
        request.addFile({
            hash: fileHash,
            name: "name1",
            contentType: "text/plain",
            oid: 1234,
            nature: "nature1",
            submitter: SUBMITTER,
            restrictedDelivery: false,
            size: 123,
        }, false);
        expect(request.getFiles(SUBMITTER).length).toBe(1);
        const itemName = "Some name";
        request.addMetadataItem({
            name: itemName,
            value: "Some value",
            submitter: SUBMITTER,
        }, false);
        expect(request.getMetadataItems(SUBMITTER).length).toBe(1);

        // User requests review
        request.submit();
        thenRequestStatusIs("REVIEW_PENDING");
        thenFileStatusIs(fileHash, "REVIEW_PENDING");
        thenMetadataItemStatusIs(itemName, "REVIEW_PENDING");

        // LLO rejects
        request.reject("Because.", moment());
        thenRequestStatusIs("REVIEW_REJECTED");
        thenFileStatusIs(fileHash, "REVIEW_REJECTED");
        thenMetadataItemStatusIs(itemName, "REVIEW_REJECTED");

        // User reworks and submits again
        request.rework();
        thenRequestStatusIs("DRAFT");
        thenFileStatusIs(fileHash, "DRAFT");
        thenMetadataItemStatusIs(itemName, "DRAFT");
        request.submit();

        // LLO accepts
        request.accept(moment());
        thenRequestStatusIs("REVIEW_ACCEPTED");
        request.acceptFile(fileHash);
        thenFileStatusIs(fileHash, "REVIEW_ACCEPTED");
        request.acceptMetadataItem(itemName);
        thenMetadataItemStatusIs(itemName, "REVIEW_ACCEPTED");

        // User reworks and submits again
        request.rework();
        request.submit();

        // LLO accepts again
        request.accept(moment());
        request.acceptFile(fileHash);
        request.acceptMetadataItem(itemName);
        thenRequestStatusIs("REVIEW_ACCEPTED");

        // User opens
        request.open(moment());
        thenRequestStatusIs("OPEN");

        // User publishes items
        request.confirmFile(fileHash);
        request.setFileAddedOn(fileHash, moment()); // Sync
        request.confirmFileAcknowledged(fileHash);

        request.confirmMetadataItem(itemName);
        request.setMetadataItemAddedOn(itemName, moment()); // Sync
        request.confirmMetadataItemAcknowledged(itemName);

        // LLO adds other data
        request.addFile({
            hash: "hash2",
            name: "name2",
            contentType: "text/plain",
            oid: 1235,
            nature: "nature2",
            submitter: OWNER_ACCOUNT,
            restrictedDelivery: false,
            size: 123,
        }, true);
        request.confirmFile("hash2");
        request.setFileAddedOn("hash2", moment()); // Sync

        const target = new UUID().toString();
        request.addLink({
            nature: "Some link nature",
            target: target,
        });
        request.confirmLink(target);
        request.setLinkAddedOn(target, moment()); // Sync

        const someOtherName = "Some other name";
        request.addMetadataItem({
            name: someOtherName,
            value: "Some other value",
            submitter: OWNER_ACCOUNT,
        }, true);
        request.confirmMetadataItem(someOtherName);
        request.setMetadataItemAddedOn(someOtherName, moment()); // Sync
        request.confirmMetadataItemAcknowledged(someOtherName);

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
    request.requesterAddress = SUBMITTER.address;
    request.requesterAddressType = SUBMITTER.type;
}

const OWNER = ALICE;
const OWNER_ACCOUNT = ALICE_ACCOUNT;

let request: LocRequestAggregateRoot;

function whenRejecting(rejectReason: string, rejectedOn: Moment) {
    request.reject(rejectReason, rejectedOn);
}

function whenAccepting(acceptedOn: Moment) {
    request.accept(acceptedOn);
}

function whenOpening() {
    request.open();
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
    request = await factory.newLOLocRequest({
        id: requestId,
        description: locDescription
    });
}

const repository = new Mock<LocRequestRepository>();

function thenRequestCreatedWithDescription(description: LocRequestDescription) {
    expect(request.id).toBe(requestId);
    expect(request.status).toBe('REVIEW_PENDING');
    expect(request.getDescription()).toEqual(description);
    expect(request.decisionOn).toBeUndefined();
}

function whenUpdatingFile(hash: string, restrictedDelivery: boolean) {
    request.setFileRestrictedDelivery({ hash, restrictedDelivery });
}

function whenAddingFiles(files: FileParams[], alreadyReviewed: boolean) {
    files.forEach(file => request.addFile(file, alreadyReviewed));
}

function thenExposesFiles(expectedFiles: FileParams[]) {
    request.getFiles().forEach((file, index) => {
        expectSameFiles(file, expectedFiles[index]);
    });
}

function expectSameFiles(f1: FileDescription, f2: Partial<FileDescription>) {
    expect(f1.hash).toEqual(f2.hash!);
    expect(f1.name).toEqual(f2.name!);
    expect(f1.oid).toEqual(f2.oid);
    expect(f1.contentType).toEqual(f2.contentType!);
    expect(f1.nature).toEqual(f2.nature!);
    expect(f1.submitter).toEqual(f2.submitter!);
    expect(f1.restrictedDelivery).toEqual(f2.restrictedDelivery!);
}

function thenExposesFileByHash(hash: string, expectedFile: Partial<FileDescription>) {
    expectSameFiles(request.getFile(hash), expectedFile);
}

function thenHasFile(hash: string) {
    expect(request.hasFile(hash)).toBe(true);
}

function whenAddingMetadata(metadata: MetadataItemParams[], alreadyReviewed: boolean) {
    metadata.forEach(item => request.addMetadataItem(item, alreadyReviewed));
}

function thenExposesMetadata(expectedMetadata: Partial<MetadataItemDescription>[]) {
    request.getMetadataItems().forEach((item, index) => {
        expect(item.name).toBe(expectedMetadata[index].name!);
        expect(item.value).toBe(expectedMetadata[index].value!);
        expect(item.submitter).toBe(expectedMetadata[index].submitter!);
        if (item.addedOn === undefined) {
            expect(expectedMetadata[index].addedOn).not.toBeDefined()
        } else {
            expect(item.addedOn.isSame(expectedMetadata[index].addedOn)).toBe(true);
        }
    });
}

function thenExposesMetadataItemByName(name: string, expectedMetadataItem: Partial<MetadataItemDescription>) {
    expectSameMetadataItems(request.getMetadataItem(name), expectedMetadataItem)
}

function expectSameMetadataItems(item1: MetadataItemDescription, item2: Partial<MetadataItemDescription>) {
    expect(item1.name).toEqual(item2.name!);
    expect(item1.value).toEqual(item2.value!);
    expect(item1.submitter).toEqual(item2.submitter!);
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

function thenMetadataItemStatusIs(name: string, expectedStatus: ItemStatus) {
    expect(request.metadataItem(name)?.status).toEqual(expectedStatus);
}

function thenMetadataItemRequiresUpdate(name: string) {
    expect(request.metadataItem(name)?._toUpdate).toBeTrue();
}

function thenMetadataIsVisibleToRequester(name: string) {
    expect(request.getMetadataItems(SUBMITTER).length).toEqual(1);
    expect(request.getMetadataItems(SUBMITTER)[0].name).toEqual(name);
}

function whenSettingFileAddedOn(hash: string, addedOn:Moment) {
    request.setFileAddedOn(hash, addedOn);
}

function whenConfirmingFile(hash: string) {
    request.confirmFile(hash);
}

function thenFileStatusIs(hash: string, status: ItemStatus) {
    expect(request.files?.find(file => file.hash === hash)?.status).toEqual(status)
}

function thenFileRequiresUpdate(hash: string) {
    expect(request.files?.find(file => file.hash === hash)?._toUpdate).toBeTrue();
}

function thenFileIsVisibleToRequester(hash: string) {
    expect(request.getFiles(SUBMITTER).length).toEqual(1);
    expect(request.getFiles(SUBMITTER)[0].hash).toEqual(hash);
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

function whenRemovingMetadataItem(remover: SupportedAccountId, name: string) {
    request.removeMetadataItem(remover, name);
}

function whenRemovingLink(remover: SupportedAccountId, target: string) {
    request.removeLink(remover, target);
}

function whenRemovingFile(remover: SupportedAccountId, hash: string) {
    removedFile = request.removeFile(remover, hash);
}

let removedFile: FileDescription;

function whenSubmitting() {
    request.submit();
}

function thenReturnedRemovedFile(expectedFile: FileParams) {
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
