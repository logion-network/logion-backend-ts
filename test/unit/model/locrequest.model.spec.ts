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
    ItemStatus,
    FileParams,
    LinkParams, SubmissionType, EMPTY_ITEMS
} from "../../../src/logion/model/locrequest.model.js";
import { UserIdentity } from "../../../src/logion/model/useridentity.js";
import { Mock, It } from "moq.ts";
import { PostalAddress } from "../../../src/logion/model/postaladdress.js";
import {
    Seal,
    PersonalInfoSealService,
    PublicSeal,
    LATEST_SEAL_VERSION
} from "../../../src/logion/services/seal.service.js";
import { UUID } from "@logion/node-api";
import { IdenfyVerificationSession, IdenfyVerificationStatus } from "src/logion/services/idenfy/idenfy.types.js";
import { SupportedAccountId } from "../../../src/logion/model/supportedaccountid.model.js";
import { Hash } from "../../../src/logion/lib/crypto/hashing.js";
import { POLKADOT_REQUESTER } from "../controllers/locrequest.controller.shared.js";

const SUBMITTER: SupportedAccountId = {
    type: "Polkadot",
    address: "5DDGQertEH5qvKVXUmpT3KNGViCX582Qa2WWb8nGbkmkRHvw"
};

const VERIFIED_ISSUER: SupportedAccountId = {
    type: "Polkadot",
    address: "5EBxoSssqNo23FvsDeUxjyQScnfEiGxJaNwuwqBH2Twe35BX"
};

const PUBLIC_SEAL: PublicSeal = {
    hash: Hash.fromHex("0x48aedf4e08e46b24970d97db566bfa6668581cc2f37791bac0c9817a4508607a"),
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

    function mockRequesterIdentityLoc(requesterAddress?: string): string {
        const requesterIdentityLocId = uuid().toString();
        const requesterIdentityLoc = new Mock<LocRequestAggregateRoot>();
        requesterIdentityLoc.setup(instance => instance.id).returns(requesterIdentityLocId);
        if (requesterAddress) {
            requesterIdentityLoc.setup(instance => instance.requesterAddress).returns(requesterAddress);
            requesterIdentityLoc.setup(instance => instance.requesterAddressType).returns("Polkadot");
        }
        repository.setup(instance => instance.findById(requesterIdentityLocId)).returns(Promise.resolve(requesterIdentityLoc.object()));
        return requesterIdentityLocId;
    }

    it("creates Transaction LOC request with requester having POLKADOT identity", async () => {
        givenRequestId(uuid());
        const requesterAddress = "5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW";
        const requesterIdentityLocId = mockRequesterIdentityLoc(requesterAddress);
        const description = createDescription('Transaction', requesterAddress, requesterIdentityLocId);
        givenLocDescription(description);
        await whenCreatingLocRequest(false);
        thenRequestCreatedWithDescription(description, "REVIEW_PENDING");
        thenStatusIs("REVIEW_PENDING");
    });

    it("creates Transaction LOC with requester having POLKADOT identity", async () => {
        givenRequestId(uuid());
        const requesterAddress = "5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW";
        const requesterIdentityLocId = mockRequesterIdentityLoc(requesterAddress);
        const description = createDescription('Transaction', requesterAddress, requesterIdentityLocId);
        givenLocDescription(description);
        const metadata: MetadataItemParams[] = [
            { name: "data01", value: "value01", submitter: POLKADOT_REQUESTER },
            { name: "data02", value: "value02", submitter: POLKADOT_REQUESTER },
        ];
        const links: LinkParams[] = [
            { target: "3eb0334a-3524-4eb0-bf44-e44176b72d3e", nature: "some linked loc", submitter: POLKADOT_REQUESTER }
        ];
        await whenCreatingLoc(metadata, links);
        thenRequestCreatedWithDescription(description, "OPEN");
        thenLocCreatedWithMetadata(metadata, "PUBLISHED");
        thenLocCreatedWithLinks(links, "PUBLISHED");
        thenStatusIs("OPEN");
    });

    it("creates an open Transaction LOC with requester having a POLKADOT identity", async () => {
        givenRequestId(uuid());
        const requesterAddress = "5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW";
        const requesterIdentityLocId = mockRequesterIdentityLoc(requesterAddress);
        const description = createDescription('Transaction', requesterAddress, requesterIdentityLocId);
        givenLocDescription(description);
        await whenLOCreatingOpenLoc();
        thenRequestCreatedWithDescription(description, "OPEN");
    });

    it("creates an open Transaction LOC with requester having LOGION identity", async () => {
        givenRequestId(uuid());
        const requesterIdentityLocId = mockRequesterIdentityLoc();
        const description = createDescription('Transaction', undefined, requesterIdentityLocId);
        givenLocDescription(description);
        await whenLOCreatingOpenLoc();
        thenRequestCreatedWithDescription(description, "OPEN")
    });

    it("fails to create an open Transaction LOC without identity LOC", async () => {
        givenRequestId(uuid());
        const description = createDescription('Transaction', "5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW");
        givenLocDescription(description);
        await expectAsyncToThrow(whenLOCreatingOpenLoc);
    });

    it("fails to create an open Transaction LOC with no requester", async () => {
        givenRequestId(uuid());
        const description = createDescription('Transaction');
        givenLocDescription(description);
        await expectAsyncToThrow(whenLOCreatingOpenLoc);
    });

    it("creates Collection LOC request with requester having POLKADOT identity", async () => {
        givenRequestId(uuid());
        const requesterAddress = "5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW";
        const requesterIdentityLocId = mockRequesterIdentityLoc(requesterAddress);
        const description = createDescription('Collection', requesterAddress, requesterIdentityLocId);
        givenLocDescription(description);
        await whenCreatingLocRequest(false);
        thenRequestCreatedWithDescription(description, "REVIEW_PENDING");
    });

    it("creates an open Collection LOC with requester having POLKADOT identity", async () => {
        givenRequestId(uuid());
        const requesterAddress = "5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW";
        const requesterIdentityLocId = mockRequesterIdentityLoc(requesterAddress);
        const description = createDescription('Collection', requesterAddress, requesterIdentityLocId);
        givenLocDescription(description);
        await whenLOCreatingOpenLoc();
        thenRequestCreatedWithDescription(description, "OPEN");
    });

    it("creates an open Collection LOC with requester having a LOGION identity", async () => {
        givenRequestId(uuid());
        const requesterIdentityLocId = mockRequesterIdentityLoc();
        const description = createDescription('Collection', undefined, requesterIdentityLocId);
        givenLocDescription(description);
        await whenLOCreatingOpenLoc();
        thenRequestCreatedWithDescription(description, "OPEN");
    });

    it("fails to create an open Collection LOC without identity LOC", async () => {
        givenRequestId(uuid());
        const description = createDescription('Collection', "5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW");
        givenLocDescription(description);
        await expectAsyncToThrow(whenLOCreatingOpenLoc);
    });

    it("fails to create an open Collection LOC with no requester", async () => {
        givenRequestId(uuid());
        const description = createDescription('Collection');
        givenLocDescription(description);
        await expectAsyncToThrow(whenLOCreatingOpenLoc);
    });

    it("fails to create Identity LOC with undefined user identity", async () => {
        givenRequestId(uuid());
        const description = createDescription('Identity', "5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW", undefined, undefined, undefined, PUBLIC_SEAL);
        givenLocDescription(description);
        await expectAsyncToThrow(whenLOCreatingOpenLoc, "Logion Identity LOC request must contain first name, last name, email and phone number.");
    });

    it("fails to create Identity LOC with incomplete user identity", async () => {
        givenRequestId(uuid());
        const description = createDescription('Identity', "5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW", undefined, { firstName: "Scott"} as UserIdentity, undefined, PUBLIC_SEAL);
        givenLocDescription(description);
        await expectAsyncToThrow(whenLOCreatingOpenLoc, "Logion Identity LOC request must contain first name, last name, email and phone number.");
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
        thenRequestCreatedWithDescription(description, "REVIEW_PENDING");
        thenRequestSealIs(SEAL);
        expect(description.userIdentity).toEqual(userIdentity);
        expect(description.userPostalAddress).toEqual(userPostalAddress);
    });

    it("creates an open Identity LOC with requester address", async () => {
        givenRequestId(uuid());
        const description = createDescription('Identity', "5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW", undefined, userIdentity, undefined, PUBLIC_SEAL);
        givenLocDescription(description);
        await whenLOCreatingOpenLoc();
        thenRequestCreatedWithDescription(description, "OPEN");
    });

    it("fails to create an open Identity LOC with requester id loc", async () => {
        givenRequestId(uuid());
        const description = createDescription('Identity', undefined, uuid().toString());
        givenLocDescription(description);
        await expectAsyncToThrow(whenLOCreatingOpenLoc);
    });

    it("fails to create an open Identity LOC with 2 requesters", async () => {
        givenRequestId(uuid());
        const description = createDescription('Identity', "5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW", uuid().toString());
        givenLocDescription(description);
        await expectAsyncToThrow(whenLOCreatingOpenLoc);
    });

    it("creates an open Identity LOC with no requester", async () => {
        givenRequestId(uuid());
        const description = createDescription('Identity', undefined, undefined, userIdentity);
        givenLocDescription(description);
        await whenLOCreatingOpenLoc();
    });

    it("fails to create an open Identity LOC with no requester when identity is missing", async () => {
        givenRequestId(uuid());
        const description = createDescription('Identity');
        givenLocDescription(description);
        await expectAsyncToThrow(whenLOCreatingOpenLoc);
    });

    it("creates SOF LOC request", async () => {
        givenRequestId(uuid());
        const requesterAddress = "5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW";
        const requesterIdentityLocId = mockRequesterIdentityLoc(requesterAddress);
        const description = createDescription('Transaction', requesterAddress, requesterIdentityLocId);
        givenLocDescription(description);
        const target = "target-loc"
        const nature = "Original LOC"
        await whenCreatingSofRequest(target, nature);
        thenRequestCreatedWithDescription({
            ...description,
            template: "statement_of_facts"
        }, "REVIEW_PENDING");
        expect(request.links?.length).toBe(1)
        expect(request.links![0].target).toEqual(target)
        expect(request.links![0].nature).toEqual(nature)
    });

    it("creates a draft request", async () => {
        givenRequestId(uuid());
        const requesterAddress = "5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW";
        const requesterIdentityLocId = mockRequesterIdentityLoc();
        const description = createDescription('Transaction', requesterAddress, requesterIdentityLocId);
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
            fees: {
                legalFee: 2000n,
                valueFee: locType === "Collection" ? 100n : undefined,
                collectionItemFee: locType === "Collection" ? 50n : undefined,
                tokensRecordFee: locType === "Collection" ? 50n : undefined,
            }
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

    it("fails accepting with non-accepted metadata", () => {
        givenRequestWithStatus('DRAFT');
        request.addMetadataItem({
            name: "Test",
            value: "Value",
            submitter: SUBMITTER,
        }, "MANUAL_BY_USER");
        request.submit();
        expect(() => request.accept(ACCEPTED_ON)).toThrowError("A metadata item was not yet accepted");
    });

    it("fails accepting with non-accepted file", () => {
        givenRequestWithStatus('DRAFT');
        request.addFile({
            hash: Hash.of("Test"),
            name: "Test",
            nature: "Test",
            restrictedDelivery: false,
            size: 4,
            submitter: SUBMITTER,
        }, "MANUAL_BY_USER");
        request.submit();
        expect(() => request.accept(ACCEPTED_ON)).toThrowError("A file was not yet accepted");
    });

    it("fails accepting with non-accepted link", () => {
        givenRequestWithStatus('DRAFT');
        request.addLink({
            nature: "Test",
            target: new UUID().toString(),
            submitter: SUBMITTER,
        }, "MANUAL_BY_USER");
        request.submit();
        expect(() => request.accept(ACCEPTED_ON)).toThrowError("A link was not yet accepted");
    });

    it("opens an accepted request", () => {
        givenRequestWithStatus('REVIEW_ACCEPTED');
        whenPreOpening(false);
        thenRequestStatusIs('OPEN');
    });

    it("cancels pre-open", () => {
        givenRequestWithStatus('OPEN');
        request.cancelPreOpen(false);
        thenRequestStatusIs('REVIEW_ACCEPTED');
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
        whenOpening(locCreatedDate);
        thenExposesLocCreatedDate(locCreatedDate);
    });

    it("pre-closes", () => {
        givenRequestWithStatus('OPEN');
        whenPreClosing();
        thenRequestStatusIs('CLOSED');
    });

    it("cancels pre-close", () => {
        givenRequestWithStatus('CLOSED');
        request.cancelPreClose(false);
        thenRequestStatusIs('OPEN');
    });

    it("fails auto-ack pre-close with metadata not published on-chain", () => {
        givenRequestWithStatus('OPEN');
        const name = "Name";
        request.addMetadataItem({
            name,
            submitter: SUBMITTER,
            value: "Value",
        }, "DIRECT_BY_REQUESTER");
        expect(() => request.preClose(true)).toThrowError("A metadata item was not yet published nor acknowledged");
    });

    it("fails auto-ack pre-close with metadata not acknowledged on-chain by VI", () => {
        givenRequestWithStatus('OPEN');
        const name = "Name";
        request.addMetadataItem({
            name,
            submitter: VERIFIED_ISSUER,
            value: "Value",
        }, "DIRECT_BY_REQUESTER");
        request.preAcknowledgeMetadataItem(Hash.of(name), VERIFIED_ISSUER);
        expect(() => request.preClose(true)).toThrowError("A metadata item was not yet published nor acknowledged");
    });

    it("fails pre-close with metadata not acknowledged on-chain", () => {
        givenRequestWithStatus('OPEN');
        const name = "Name";
        request.addMetadataItem({
            name,
            submitter: SUBMITTER,
            value: "Value",
        }, "DIRECT_BY_REQUESTER");
        request.preAcknowledgeMetadataItem(Hash.of(name), ALICE_ACCOUNT);
        expect(() => request.preClose(false)).toThrowError("A metadata item was not yet acknowledged");
    });

    it("fails auto-ack pre-close with file not published on-chain", () => {
        givenRequestWithStatus('OPEN');
        const hash = Hash.of("content");
        request.addFile({
            hash,
            submitter: SUBMITTER,
            name: "Name",
            nature: "Nature",
            restrictedDelivery: false,
            size: 7,
        }, "DIRECT_BY_REQUESTER");
        expect(() => request.preClose(true)).toThrowError("A file was not yet published nor acknowledged");
    });

    it("fails auto-ack pre-close with file not acknowledged on-chain by VI", () => {
        givenRequestWithStatus('OPEN');
        const hash = Hash.of("content");
        request.addFile({
            hash,
            submitter: VERIFIED_ISSUER,
            name: "Name",
            nature: "Nature",
            restrictedDelivery: false,
            size: 7,
        }, "DIRECT_BY_REQUESTER");
        request.preAcknowledgeFile(hash, VERIFIED_ISSUER);
        expect(() => request.preClose(true)).toThrowError("A file was not yet published nor acknowledged");
    });

    it("fails pre-close with file not acknowledged on-chain", () => {
        givenRequestWithStatus('OPEN');
        const hash = Hash.of("content");
        request.addFile({
            hash,
            submitter: SUBMITTER,
            name: "Name",
            nature: "Nature",
            restrictedDelivery: false,
            size: 7,
        }, "DIRECT_BY_REQUESTER");
        request.preAcknowledgeFile(hash, ALICE_ACCOUNT);
        expect(() => request.preClose(false)).toThrowError("A file was not yet acknowledged");
    });

    it("fails auto-ack pre-close with link not published on-chain", () => {
        givenRequestWithStatus('OPEN');
        const target = new UUID().toString();
        request.addLink({
            target,
            submitter: SUBMITTER,
            nature: "Nature",
        }, "DIRECT_BY_REQUESTER");
        expect(() => request.preClose(true)).toThrowError("A link was not yet published nor acknowledged");
    });

    it("fails auto-ack pre-close with link not acknowledged on-chain by VI", () => {
        givenRequestWithStatus('OPEN');
        const target = new UUID().toString();
        request.addLink({
            target,
            submitter: VERIFIED_ISSUER,
            nature: "Nature",
        }, "DIRECT_BY_REQUESTER");
        request.preAcknowledgeLink(target, VERIFIED_ISSUER);
        expect(() => request.preClose(true)).toThrowError("A link was not yet published nor acknowledged");
    });

    it("fails pre-close with link not acknowledged on-chain", () => {
        givenRequestWithStatus('OPEN');
        const target = new UUID().toString();
        request.addLink({
            target,
            submitter: SUBMITTER,
            nature: "Nature",
        }, "DIRECT_BY_REQUESTER");
        request.preAcknowledgeLink(target, ALICE_ACCOUNT);
        expect(() => request.preClose(false)).toThrowError("A link was not yet acknowledged");
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

    it("cancels pre-voided LOC", () => {
        givenPreVoidedRequest('OPEN');
        whenCancelingPreVoid();
        thenVoidInfoIs(undefined);
    });

    it("fails to cancelPreVoid non pre-voided LOC", () => {
        givenRequestWithStatus('OPEN');
        expect(whenCancelingPreVoid).toThrowError("Cannot cancelPreVoid a non pre-Voided LOC")
        thenVoidInfoIs(undefined);
    });

    it("fails to cancelPreVoid Voided LOC", () => {
        givenVoidedRequest('OPEN');
        expect(whenCancelingPreVoid).toThrowError("Cannot cancelPreVoid a Void LOC")
        thenVoidInfoIs({
            reason: VOID_REASON,
            voidedOn: VOIDED_ON,
        });
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
        whenOpening(locCreatedDate);
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
        expect(() => whenAddingMetadata(items, "MANUAL_BY_USER")).toThrowError();
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
        whenAddingMetadata(metadata, "MANUAL_BY_USER");
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
        whenAddingMetadata(items, "MANUAL_BY_USER");
        whenRemovingMetadataItem(remover, Hash.of(items[1].name))

        const newItems: MetadataItemParams[] = [
            {
                name: "name1",
                value: "some nice value",
                submitter: SUBMITTER,
            }
        ];
        const nameHash1 = Hash.of(items[0].name);
        thenExposesMetadata(newItems);
        thenExposesMetadataItemByNameHash(nameHash1, { ...newItems[0], nameHash: nameHash1 });
        thenHasMetadataItem(nameHash1);
        thenHasExpectedMetadataIndices();
    }

    it("confirms metadata item", () => {
        givenRequestWithStatus('OPEN');
        const name = "target-1";
        const nameHash = Hash.of(name);
        whenAddingMetadata([
            {
                name,
                value: "value-1",
                submitter: SUBMITTER,
            }
        ], "MANUAL_BY_OWNER")
        whenConfirmingMetadataItem(nameHash, SUBMITTER)
        thenMetadataItemStatusIs(nameHash, "PUBLISHED")
        thenMetadataItemRequiresUpdate(nameHash)
    })

    it("cancels requester metadata item pre-publish", () => {
        givenRequestWithStatus('OPEN');
        const name = "target-1";
        const nameHash = Hash.of(name);
        whenAddingMetadata([
            {
                name,
                value: "value-1",
                submitter: SUBMITTER,
            }
        ], "MANUAL_BY_USER");
        request.requestMetadataItemReview(nameHash);
        request.acceptMetadataItem(nameHash);
        whenConfirmingMetadataItem(nameHash, SUBMITTER);
        request.cancelPrePublishOrAcknowledgeMetadataItem(nameHash, SUBMITTER);
        thenMetadataItemStatusIs(nameHash, "REVIEW_ACCEPTED");
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
        ], "MANUAL_BY_USER")
        thenMetadataIsVisibleToRequester(name);
    })

    it("exposes reviewed, VI-submitted metadata to requester", () => {
        givenRequestWithStatus('OPEN');
        const name = "target-3";
        whenAddingMetadata([
            {
                name,
                value: "value-1",
                submitter: SUBMITTER,
            }
        ], "MANUAL_BY_OWNER")
        thenMetadataIsVisibleToRequester(name);
    })

    it("confirms metadata acknowledgment (owner only)", () => {
        givenRequestWithStatus('OPEN');
        const name = "name";
        const nameHash = Hash.of(name);
        request.addMetadataItem({
            name,
            submitter: SUBMITTER,
            value: "value",
        }, "MANUAL_BY_USER");
        request.requestMetadataItemReview(nameHash);
        request.acceptMetadataItem(nameHash);
        request.prePublishOrAcknowledgeMetadataItem(nameHash, SUBMITTER);

        request.preAcknowledgeMetadataItem(nameHash, OWNER_ACCOUNT, moment());
        expect(request.getMetadataOrThrow(nameHash).lifecycle?.acknowledgedByVerifiedIssuerOn).not.toBeDefined();
        expect(request.getMetadataOrThrow(nameHash).lifecycle?.acknowledgedByOwnerOn).toBeDefined();
        expect(request.getMetadataOrThrow(nameHash).lifecycle?.status).toBe("ACKNOWLEDGED");
    });

    it("confirms metadata acknowledgment (owner then verified issuer)", () => {
        givenRequestWithStatus('OPEN');
        const name = "name";
        const nameHash = Hash.of(name);
        request.addMetadataItem({
            name,
            submitter: VERIFIED_ISSUER,
            value: "value",
        }, "MANUAL_BY_USER");
        request.requestMetadataItemReview(nameHash);
        request.acceptMetadataItem(nameHash);
        request.prePublishOrAcknowledgeMetadataItem(nameHash, SUBMITTER);

        request.preAcknowledgeMetadataItem(nameHash, OWNER_ACCOUNT, moment());
        expect(request.getMetadataOrThrow(nameHash).lifecycle?.acknowledgedByVerifiedIssuerOn).not.toBeDefined();
        expect(request.getMetadataOrThrow(nameHash).lifecycle?.acknowledgedByOwnerOn).toBeDefined();
        expect(request.getMetadataOrThrow(nameHash).lifecycle?.status).toBe("PUBLISHED");

        request.preAcknowledgeMetadataItem(nameHash, VERIFIED_ISSUER, moment());
        expect(request.getMetadataOrThrow(nameHash).lifecycle?.acknowledgedByVerifiedIssuerOn).toBeDefined();
        expect(request.getMetadataOrThrow(nameHash).lifecycle?.acknowledgedByOwnerOn).toBeDefined();
        expect(request.getMetadataOrThrow(nameHash).lifecycle?.status).toBe("ACKNOWLEDGED");
    });

    it("confirms metadata acknowledgment (verified issuer then owner)", () => {
        givenRequestWithStatus('OPEN');
        const name = "name";
        const nameHash = Hash.of(name);
        request.addMetadataItem({
            name,
            submitter: VERIFIED_ISSUER,
            value: "value",
        }, "MANUAL_BY_USER");
        request.requestMetadataItemReview(nameHash);
        request.acceptMetadataItem(nameHash);
        request.prePublishOrAcknowledgeMetadataItem(nameHash, SUBMITTER);

        request.preAcknowledgeMetadataItem(nameHash, VERIFIED_ISSUER, moment());
        expect(request.getMetadataOrThrow(nameHash).lifecycle?.acknowledgedByVerifiedIssuerOn).toBeDefined();
        expect(request.getMetadataOrThrow(nameHash).lifecycle?.acknowledgedByOwnerOn).not.toBeDefined();
        expect(request.getMetadataOrThrow(nameHash).lifecycle?.status).toBe("PUBLISHED");

        request.preAcknowledgeMetadataItem(nameHash, OWNER_ACCOUNT, moment());
        expect(request.getMetadataOrThrow(nameHash).lifecycle?.acknowledgedByVerifiedIssuerOn).toBeDefined();
        expect(request.getMetadataOrThrow(nameHash).lifecycle?.acknowledgedByOwnerOn).toBeDefined();
        expect(request.getMetadataOrThrow(nameHash).lifecycle?.status).toBe("ACKNOWLEDGED");
    });

    it("cancel metadata acknowledgment (owner only)", () => {
        givenRequestWithStatus('OPEN');
        const name = "name";
        const nameHash = Hash.of(name);
        request.addMetadataItem({
            name,
            submitter: SUBMITTER,
            value: "value",
        }, "MANUAL_BY_USER");
        request.requestMetadataItemReview(nameHash);
        request.acceptMetadataItem(nameHash);
        request.prePublishOrAcknowledgeMetadataItem(nameHash, SUBMITTER);

        request.preAcknowledgeMetadataItem(nameHash, OWNER_ACCOUNT);
        expect(request.getMetadataOrThrow(nameHash).lifecycle?.status).toBe("ACKNOWLEDGED");
        request.cancelPreAcknowledgeMetadataItem(nameHash, OWNER_ACCOUNT);
        expect(request.getMetadataOrThrow(nameHash).lifecycle?.status).toBe("PUBLISHED");
    });

    it("cancel metadata acknowledgment (owner then verified issuer)", () => {
        givenRequestWithStatus('OPEN');
        const name = "name";
        const nameHash = Hash.of(name);
        request.addMetadataItem({
            name,
            submitter: VERIFIED_ISSUER,
            value: "value",
        }, "MANUAL_BY_USER");
        request.requestMetadataItemReview(nameHash);
        request.acceptMetadataItem(nameHash);
        request.prePublishOrAcknowledgeMetadataItem(nameHash, SUBMITTER);

        request.preAcknowledgeMetadataItem(nameHash, OWNER_ACCOUNT);
        request.preAcknowledgeMetadataItem(nameHash, VERIFIED_ISSUER);
        expect(request.getMetadataOrThrow(nameHash).lifecycle?.status).toBe("ACKNOWLEDGED");
        request.cancelPreAcknowledgeMetadataItem(nameHash, VERIFIED_ISSUER);
        expect(request.getMetadataOrThrow(nameHash).lifecycle?.status).toBe("PUBLISHED");
    });

    it("cancel metadata acknowledgment (verified issuer then owner)", () => {
        givenRequestWithStatus('OPEN');
        const name = "name";
        const nameHash = Hash.of(name);
        request.addMetadataItem({
            name,
            submitter: VERIFIED_ISSUER,
            value: "value",
        }, "MANUAL_BY_USER");
        request.requestMetadataItemReview(nameHash);
        request.acceptMetadataItem(nameHash);
        request.prePublishOrAcknowledgeMetadataItem(nameHash, SUBMITTER);

        request.preAcknowledgeMetadataItem(nameHash, VERIFIED_ISSUER);
        request.preAcknowledgeMetadataItem(nameHash, OWNER_ACCOUNT);
        expect(request.getMetadataOrThrow(nameHash).lifecycle?.status).toBe("ACKNOWLEDGED");
        request.cancelPreAcknowledgeMetadataItem(nameHash, OWNER_ACCOUNT);
        expect(request.getMetadataOrThrow(nameHash).lifecycle?.status).toBe("PUBLISHED");
    });

    it("requester cannot remove accepted metadata", () => {
        const nameHash = givenRequestWithAcceptedMetadata();
        expect(() => request.removeMetadataItem(SUBMITTER, nameHash)).toThrowError("Item removal not allowed");
    });

    it("owner cannot remove accepted metadata", () => {
        const nameHash = givenRequestWithAcceptedMetadata();
        expect(() => request.removeMetadataItem(ALICE_ACCOUNT, nameHash)).toThrowError("Item removal not allowed");
    });
})

function givenRequestWithAcceptedMetadata() {
    givenRequestWithStatus("OPEN");
    const name = "Name";
    request.addMetadataItem({
        name,
        submitter: SUBMITTER,
        value: "Value",
    }, "MANUAL_BY_USER");
    const nameHash = Hash.of(name);
    request.requestMetadataItemReview(nameHash);
    request.acceptMetadataItem(nameHash);
    return nameHash;
}

describe("LocRequestAggregateRoot (links)", () => {

    it("does not accept several links with same target", () => {
        givenRequestWithStatus('OPEN');
        const links: LinkParams[] = [
            {
                target: "another-loc-id",
                nature: "nature1",
                submitter: SUBMITTER,
            },
            {
                target: "another-loc-id",
                nature: "nature2",
                submitter: SUBMITTER,
            }
        ];
        expect(() => whenAddingLinks(links, "MANUAL_BY_USER")).toThrowError();
    });

    it("adds and exposes links", () => {
        givenRequestWithStatus('OPEN');
        const links: LinkParams[] = [
            {
                target: "value1",
                nature: "nature1",
                submitter: SUBMITTER,
            },
            {
                target: "value2",
                nature: "nature2",
                submitter: SUBMITTER,
            }
        ];
        whenAddingLinks(links, "MANUAL_BY_USER");
        thenExposesLinks(links);
    });

    it("cannot remove link if not contributor", () => {
        givenRequestWithStatus('OPEN');
        const links: LinkParams[] = [
            {
                target: "target-1",
                nature: "nature-1",
                submitter: POLKADOT_REQUESTER,
            },
            {
                target: "target-2",
                nature: "nature-2",
                submitter: OWNER_ACCOUNT,
            }
        ];
        whenAddingLinks(links, "MANUAL_BY_OWNER");
        expect(() => whenRemovingLink(SUBMITTER, "target-1")).toThrowError();
    });

    it("confirms link", () => {
        givenRequestWithStatus('OPEN');
        const target = "target-1";
        whenAddingLinks([
            {
                target,
                nature: "nature-1",
                submitter: SUBMITTER,
            }
        ], "MANUAL_BY_OWNER");
        whenConfirmingLink(target, SUBMITTER);
        thenLinkStatusIs(target, "PUBLISHED");
        thenLinkRequiresUpdate(target)
    })

    it("cancels link pre-publish", () => {
        givenRequestWithStatus('OPEN');
        const target = "target-1";
        whenAddingLinks([
            {
                target,
                nature: "nature-1",
                submitter: SUBMITTER,
            }
        ], "MANUAL_BY_OWNER");
        whenConfirmingLink(target, SUBMITTER);
        thenLinkStatusIs(target, "PUBLISHED");
        request.cancelPrePublishOrAcknowledgeLink(target, SUBMITTER);
        thenLinkStatusIs(target, "REVIEW_ACCEPTED");
    })

    it("confirms link acknowledgment (owner only)", () => {
        givenRequestWithStatus('OPEN');
        const target = new UUID().toString();
        request.addLink({
            target: target,
            nature: "SomeLinkedLoc",
            submitter: SUBMITTER,
        }, "MANUAL_BY_USER");
        request.requestLinkReview(target);
        request.acceptLink(target);
        request.prePublishOrAcknowledgeLink(target, SUBMITTER);

        request.preAcknowledgeLink(target, OWNER_ACCOUNT, moment());
        expect(request.getLinkOrThrow(target).lifecycle?.acknowledgedByVerifiedIssuerOn).not.toBeDefined();
        expect(request.getLinkOrThrow(target).lifecycle?.acknowledgedByOwnerOn).toBeDefined();
        expect(request.getLinkOrThrow(target).lifecycle?.status).toBe("ACKNOWLEDGED");
    });

    it("confirms link acknowledgment (owner then verified issuer)", () => {
        givenRequestWithStatus('OPEN');
        const target = new UUID().toString();
        request.addLink({
            target: target,
            nature: "SomeLinkedLoc",
            submitter: VERIFIED_ISSUER,
        }, "MANUAL_BY_USER");
        request.requestLinkReview(target);
        request.acceptLink(target);
        request.prePublishOrAcknowledgeLink(target, SUBMITTER);

        request.preAcknowledgeLink(target, OWNER_ACCOUNT, moment());
        expect(request.getLinkOrThrow(target).lifecycle?.acknowledgedByVerifiedIssuerOn).not.toBeDefined();
        expect(request.getLinkOrThrow(target).lifecycle?.acknowledgedByOwnerOn).toBeDefined();
        expect(request.getLinkOrThrow(target).lifecycle?.status).toBe("PUBLISHED");

        request.preAcknowledgeLink(target, VERIFIED_ISSUER, moment());
        expect(request.getLinkOrThrow(target).lifecycle?.acknowledgedByVerifiedIssuerOn).toBeDefined();
        expect(request.getLinkOrThrow(target).lifecycle?.acknowledgedByOwnerOn).toBeDefined();
        expect(request.getLinkOrThrow(target).lifecycle?.status).toBe("ACKNOWLEDGED");
    });

    it("confirms link acknowledgment (verified issuer then owner)", () => {
        givenRequestWithStatus('OPEN');
        const target = new UUID().toString();
        request.addLink({
            target: target,
            nature: "SomeLinkedLoc",
            submitter: VERIFIED_ISSUER,
        }, "MANUAL_BY_USER");
        request.requestLinkReview(target);
        request.acceptLink(target);
        request.prePublishOrAcknowledgeLink(target, SUBMITTER);

        request.preAcknowledgeLink(target, VERIFIED_ISSUER, moment());
        expect(request.getLinkOrThrow(target).lifecycle?.acknowledgedByVerifiedIssuerOn).toBeDefined();
        expect(request.getLinkOrThrow(target).lifecycle?.acknowledgedByOwnerOn).not.toBeDefined();
        expect(request.getLinkOrThrow(target).lifecycle?.status).toBe("PUBLISHED");

        request.preAcknowledgeLink(target, OWNER_ACCOUNT, moment());
        expect(request.getLinkOrThrow(target).lifecycle?.acknowledgedByVerifiedIssuerOn).toBeDefined();
        expect(request.getLinkOrThrow(target).lifecycle?.acknowledgedByOwnerOn).toBeDefined();
        expect(request.getLinkOrThrow(target).lifecycle?.status).toBe("ACKNOWLEDGED");
    });

    it("cancels link acknowledgment (owner only)", () => {
        givenRequestWithStatus('OPEN');
        const target = new UUID().toString();
        request.addLink({
            target: target,
            nature: "SomeLinkedLoc",
            submitter: SUBMITTER,
        }, "MANUAL_BY_USER");
        request.requestLinkReview(target);
        request.acceptLink(target);
        request.prePublishOrAcknowledgeLink(target, SUBMITTER);

        request.preAcknowledgeLink(target, OWNER_ACCOUNT);
        expect(request.getLinkOrThrow(target).lifecycle?.status).toBe("ACKNOWLEDGED");
        request.cancelPreAcknowledgeLink(target, OWNER_ACCOUNT);
        expect(request.getLinkOrThrow(target).lifecycle?.status).toBe("PUBLISHED");
    });

    it("cancels link acknowledgment (owner then verified issuer)", () => {
        givenRequestWithStatus('OPEN');
        const target = new UUID().toString();
        request.addLink({
            target: target,
            nature: "SomeLinkedLoc",
            submitter: VERIFIED_ISSUER,
        }, "MANUAL_BY_USER");
        request.requestLinkReview(target);
        request.acceptLink(target);
        request.prePublishOrAcknowledgeLink(target, SUBMITTER);

        request.preAcknowledgeLink(target, OWNER_ACCOUNT);
        request.preAcknowledgeLink(target, VERIFIED_ISSUER);
        expect(request.getLinkOrThrow(target).lifecycle?.status).toBe("ACKNOWLEDGED");
        request.cancelPreAcknowledgeLink(target, VERIFIED_ISSUER);
        expect(request.getLinkOrThrow(target).lifecycle?.status).toBe("PUBLISHED");
    });

    it("cancels link acknowledgment (verified issuer then owner)", () => {
        givenRequestWithStatus('OPEN');
        const target = new UUID().toString();
        request.addLink({
            target: target,
            nature: "SomeLinkedLoc",
            submitter: VERIFIED_ISSUER,
        }, "MANUAL_BY_USER");
        request.requestLinkReview(target);
        request.acceptLink(target);
        request.prePublishOrAcknowledgeLink(target, SUBMITTER);

        request.preAcknowledgeLink(target, VERIFIED_ISSUER);
        request.preAcknowledgeLink(target, OWNER_ACCOUNT);
        expect(request.getLinkOrThrow(target).lifecycle?.status).toBe("ACKNOWLEDGED");
        request.cancelPreAcknowledgeLink(target, OWNER_ACCOUNT);
        expect(request.getLinkOrThrow(target).lifecycle?.status).toBe("PUBLISHED");
    });

    it("requester cannot remove accepted link", () => {
        const target = givenRequestWithAcceptedLink();
        expect(() => request.removeLink(SUBMITTER, target)).toThrowError("Item removal not allowed");
    });

    it("owner cannot remove accepted link", () => {
        const target = givenRequestWithAcceptedLink();
        expect(() => request.removeLink(ALICE_ACCOUNT, target)).toThrowError("Item removal not allowed");
    });
})

function givenRequestWithAcceptedLink() {
    givenRequestWithStatus("OPEN");
    const target = new UUID().toString();
    request.addLink({
        target,
        submitter: SUBMITTER,
        nature: "Nature",
    }, "MANUAL_BY_USER");
    request.requestLinkReview(target);
    request.acceptLink(target);
    return target;
}

describe("LocRequestAggregateRoot (files)", () => {

    it("adds and exposes files", () => {
        givenRequestWithStatus('OPEN');
        const files: FileParams[] = [
            {
                hash: hash1,
                name: "name1",
                contentType: "text/plain",
                cid: "cid-1234",
                nature: "nature1",
                submitter: SUBMITTER,
                restrictedDelivery: false,
                size: 123,
            },
            {
                hash: hash2,
                name: "name2",
                contentType: "text/plain",
                cid: "cid-4567",
                nature: "nature2",
                submitter: SUBMITTER,
                restrictedDelivery: false,
                size: 123,
            }
        ];
        whenAddingFiles(files, "MANUAL_BY_USER");
        thenExposesFiles(files);
        thenExposesFileByHash(hash1, files[0]);
        thenExposesFileByHash(hash2, files[1]);
        thenHasFile(hash1);
        thenHasFile(hash2);
    });

    it("does not accept several files with same hash", () => {
        givenRequestWithStatus('OPEN');
        const files: FileParams[] = [
            {
                hash: hash1,
                name: "name1",
                contentType: "text/plain",
                cid: "1234",
                nature: "nature1",
                submitter: SUBMITTER,
                restrictedDelivery: false,
                size: 123,
            },
            {
                hash: hash1,
                name: "name2",
                contentType: "text/plain",
                cid: "4567",
                nature: "nature2",
                submitter: SUBMITTER,
                restrictedDelivery: false,
                size: 123,
            }
        ];
        expect(() => whenAddingFiles(files, "MANUAL_BY_USER")).toThrowError();
    });

    it("submitter removes previously added files", () => testRemovesFile(SUBMITTER));

    function testRemovesFile(remover: SupportedAccountId) {
        givenRequestWithStatus('OPEN');
        const files: FileParams[] = [
            {
                hash: hash1,
                name: "name1",
                contentType: "text/plain",
                cid: "cid-1234",
                nature: "nature1",
                submitter: SUBMITTER,
                restrictedDelivery: false,
                size: 123,
            },
            {
                hash: hash2,
                name: "name2",
                contentType: "text/plain",
                cid: "cid-4567",
                nature: "nature2",
                submitter: SUBMITTER,
                restrictedDelivery: false,
                size: 123,
            }
        ];
        whenAddingFiles(files, "MANUAL_BY_USER");
        whenRemovingFile(remover, hash1);
        thenReturnedRemovedFile(files[0]);

        const newFiles: FileParams[] = [
            {
                hash: hash2,
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
        thenExposesFileByHash(hash2, newFiles[0]);
        thenHasFile(hash2);
        thenHasExpectedFileIndices();
    }

    it("confirms file", () => {
        givenRequestWithStatus('OPEN');
        const hash = Hash.of("hash-1");
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
        ], "MANUAL_BY_OWNER");
        whenConfirmingFile(hash, SUBMITTER)
        thenFileStatusIs(hash, "PUBLISHED")
        thenFileRequiresUpdate(hash)
    })

    it("cancel file pre-publish", () => {
        givenRequestWithStatus('OPEN');
        const hash = Hash.of("hash-1");
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
        ], "MANUAL_BY_OWNER");
        whenConfirmingFile(hash, SUBMITTER);
        thenFileStatusIs(hash, "PUBLISHED");
        request.cancelPrePublishOrAcknowledgeFile(hash, SUBMITTER);
        thenFileStatusIs(hash, "REVIEW_ACCEPTED");
    })

    it("exposes draft, owner-submitted file to requester", () => {
        givenRequestWithStatus('OPEN');
        const hash = Hash.of("hash-3");
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
        ], "MANUAL_BY_OWNER");
        thenFileIsVisibleToRequester(hash)
    })

    it("exposes reviewed, VI-submitted file to requester", () => {
        givenRequestWithStatus('OPEN');
        const hash = Hash.of("hash-3");
        whenAddingFiles([
            {
                hash,
                name: "name1",
                contentType: "text/plain",
                cid: "cid-1234",
                nature: "nature1",
                submitter: VERIFIED_ISSUER,
                restrictedDelivery: false,
                size: 123,
            }
        ], "MANUAL_BY_OWNER");
        thenFileIsVisibleToRequester(hash)
    })

    it("accepts delivered files with restricted delivery", () => {
        const hash = Hash.of("hash-1");
        givenClosedCollectionLocWithFile(hash);

        const deliveredFileHash = Hash.of("hash-2");
        request.addDeliveredFile({
            hash,
            deliveredFileHash,
            generatedOn: moment(),
            owner: OWNER,
        });

        const file = request.files?.find(file => file.hash === hash.toHex());
        expect(file?.delivered?.length).toBe(1);
        expect(file?.delivered![0].hash).toBe(hash.toHex());
        expect(file?.delivered![0].requestId).toBe(request.id);
        expect(file?.delivered![0].file).toBe(file);

        expect(file?.delivered![0].deliveredFileHash).toBe(deliveredFileHash.toHex());
        expect(file?.delivered![0].owner).toBe(OWNER);
        expect(file?.delivered![0].generatedOn).toBeDefined();

        expect(file?.delivered![0]._toAdd).toBe(true);
    })

    it("accepts delivered files with restricted delivery", () => {
        const hash = Hash.of("hash-1");
        givenClosedCollectionLocWithFile(hash);

        const deliveredFileHash = Hash.of("hash-2");
        request.addDeliveredFile({
            hash,
            deliveredFileHash,
            generatedOn: moment(),
            owner: OWNER,
        });

        const file = request.files?.find(file => file.hash === hash.toHex());
        expect(file?.delivered?.length).toBe(1);
        expect(file?.delivered![0].hash).toBe(hash.toHex());
        expect(file?.delivered![0].requestId).toBe(request.id);
        expect(file?.delivered![0].file).toBe(file);

        expect(file?.delivered![0].deliveredFileHash).toBe(deliveredFileHash.toHex());
        expect(file?.delivered![0].owner).toBe(OWNER);
        expect(file?.delivered![0].generatedOn).toBeDefined();

        expect(file?.delivered![0]._toAdd).toBe(true);
    })

    it("cannot add delivered file if not collection", () => {
        givenRequestWithStatus('CLOSED');
        request.locType = "Transaction";

        expect(() => request.addDeliveredFile({
            hash: Hash.of("hash-1"),
            deliveredFileHash: Hash.of("hash-2"),
            generatedOn: moment(),
            owner: OWNER,
        })).toThrowError("Restricted delivery is only available with Collection LOCs");
    })

    it("cannot add delivered file if not closed", () => {
        givenRequestWithStatus('OPEN');
        request.locType = "Collection";

        expect(() => request.addDeliveredFile({
            hash: Hash.of("hash-1"),
            deliveredFileHash: Hash.of("hash-2"),
            generatedOn: moment(),
            owner: OWNER,
        })).toThrowError("Restricted delivery is only possible with closed Collection LOCs");
    })

    it("cannot add delivered file if file not found", () => {
        givenRequestWithStatus('CLOSED');
        request.locType = "Collection";

        const hash = Hash.of("hash-1");
        expect(() => request.addDeliveredFile({
            hash,
            deliveredFileHash: Hash.of("hash-2"),
            generatedOn: moment(),
            owner: OWNER,
        })).toThrowError(`No file with hash ${ hash.toHex() }`);
    })

    it("updates file", () => {
        givenRequestWithStatus('OPEN');
        request.locType = "Collection";
        const file: FileParams = {
            hash: hash1,
            name: "name1",
            contentType: "text/plain",
            cid: "cid-1234",
            nature: "nature1",
            submitter: SUBMITTER,
            restrictedDelivery: false,
            size: 123,
        };
        whenAddingFiles([ file ], "MANUAL_BY_USER");
        whenUpdatingFile(hash1, false);
        thenExposesFileByHash(hash1, { ...file, restrictedDelivery: false });
        whenUpdatingFile(hash1, true);
        thenExposesFileByHash(hash1, { ...file, restrictedDelivery: true });
    });

    it("fails to update file for Identity LOC", () => {
        givenRequestWithStatus('OPEN');
        request.locType = "Identity";
        const file: FileParams = {
            hash: hash1,
            name: "name1",
            contentType: "text/plain",
            cid: "cid-1234",
            nature: "nature1",
            submitter: SUBMITTER,
            restrictedDelivery: false,
            size: 123,
        };
        whenAddingFiles([ file ], "MANUAL_BY_USER");
        expect(() => {
            whenUpdatingFile(hash1, true);
        }).toThrowError("Can change restricted delivery of file only on Collection LOC.");
    });

    it("confirms file acknowledgment (owner only)", () => {
        givenRequestWithStatus('OPEN');
        const hash = Hash.of("test");
        request.addFile({
            name: "name",
            submitter: SUBMITTER,
            hash,
            cid: "cid",
            contentType: "text/plain",
            nature: "nature",
            restrictedDelivery: false,
            size: 4,
        }, "MANUAL_BY_USER");
        request.requestFileReview(hash);
        request.acceptFile(hash);
        request.prePublishOrAcknowledgeFile(hash, SUBMITTER);

        request.preAcknowledgeFile(hash, OWNER_ACCOUNT, moment());

        expect(request.getFileOrThrow(hash).lifecycle?.acknowledgedByVerifiedIssuerOn).not.toBeDefined();
        expect(request.getFileOrThrow(hash).lifecycle?.acknowledgedByOwnerOn).toBeDefined();
        expect(request.getFileOrThrow(hash).lifecycle?.status).toBe("ACKNOWLEDGED");
    });

    it("confirms file acknowledgment (verified issuer then owner)", () => {
        givenRequestWithStatus('OPEN');
        const hash = Hash.of("test");
        request.addFile({
            name: "name",
            submitter: VERIFIED_ISSUER,
            hash,
            cid: "cid",
            contentType: "text/plain",
            nature: "nature",
            restrictedDelivery: false,
            size: 4,
        }, "MANUAL_BY_USER");
        request.requestFileReview(hash);
        request.acceptFile(hash);
        request.prePublishOrAcknowledgeFile(hash, SUBMITTER);

        request.preAcknowledgeFile(hash, VERIFIED_ISSUER, moment());
        expect(request.getFileOrThrow(hash).lifecycle?.acknowledgedByVerifiedIssuerOn).toBeDefined();
        expect(request.getFileOrThrow(hash).lifecycle?.acknowledgedByOwnerOn).not.toBeDefined();
        expect(request.getFileOrThrow(hash).lifecycle?.status).toBe("PUBLISHED");

        request.preAcknowledgeFile(hash, OWNER_ACCOUNT, moment());
        expect(request.getFileOrThrow(hash).lifecycle?.acknowledgedByOwnerOn).toBeDefined();
        expect(request.getFileOrThrow(hash).lifecycle?.status).toBe("ACKNOWLEDGED");
    });

    it("confirms file acknowledgment (owner then verified issuer)", () => {
        givenRequestWithStatus('OPEN');
        const hash = Hash.of("test");
        request.addFile({
            name: "name",
            submitter: VERIFIED_ISSUER,
            hash,
            cid: "cid",
            contentType: "text/plain",
            nature: "nature",
            restrictedDelivery: false,
            size: 4,
        }, "MANUAL_BY_USER");
        request.requestFileReview(hash);
        request.acceptFile(hash);
        request.prePublishOrAcknowledgeFile(hash, SUBMITTER);

        request.preAcknowledgeFile(hash, OWNER_ACCOUNT, moment());
        expect(request.getFileOrThrow(hash).lifecycle?.acknowledgedByOwnerOn).toBeDefined();
        expect(request.getFileOrThrow(hash).lifecycle?.acknowledgedByVerifiedIssuerOn).not.toBeDefined();
        expect(request.getFileOrThrow(hash).lifecycle?.status).toBe("PUBLISHED");

        request.preAcknowledgeFile(hash, VERIFIED_ISSUER, moment());
        expect(request.getFileOrThrow(hash).lifecycle?.acknowledgedByVerifiedIssuerOn).toBeDefined();
        expect(request.getFileOrThrow(hash).lifecycle?.status).toBe("ACKNOWLEDGED");
    });

    it("cancels file acknowledgment (owner only)", () => {
        givenRequestWithStatus('OPEN');
        const hash = Hash.of("test");
        request.addFile({
            name: "name",
            submitter: SUBMITTER,
            hash,
            cid: "cid",
            contentType: "text/plain",
            nature: "nature",
            restrictedDelivery: false,
            size: 4,
        }, "MANUAL_BY_USER");
        request.requestFileReview(hash);
        request.acceptFile(hash);
        request.prePublishOrAcknowledgeFile(hash, SUBMITTER);

        request.preAcknowledgeFile(hash, OWNER_ACCOUNT);
        expect(request.getFileOrThrow(hash).lifecycle?.status).toBe("ACKNOWLEDGED");
        request.cancelPreAcknowledgeFile(hash, OWNER_ACCOUNT);
        expect(request.getFileOrThrow(hash).lifecycle?.status).toBe("PUBLISHED");
    });

    it("cancels file acknowledgment (verified issuer then owner)", () => {
        givenRequestWithStatus('OPEN');
        const hash = Hash.of("test");
        request.addFile({
            name: "name",
            submitter: VERIFIED_ISSUER,
            hash,
            cid: "cid",
            contentType: "text/plain",
            nature: "nature",
            restrictedDelivery: false,
            size: 4,
        }, "MANUAL_BY_USER");
        request.requestFileReview(hash);
        request.acceptFile(hash);
        request.prePublishOrAcknowledgeFile(hash, SUBMITTER);

        request.preAcknowledgeFile(hash, VERIFIED_ISSUER);
        request.preAcknowledgeFile(hash, OWNER_ACCOUNT);
        expect(request.getFileOrThrow(hash).lifecycle?.status).toBe("ACKNOWLEDGED");
        request.cancelPreAcknowledgeFile(hash, OWNER_ACCOUNT);
        expect(request.getFileOrThrow(hash).lifecycle?.status).toBe("PUBLISHED");
    });

    it("cancels file acknowledgment (owner then verified issuer)", () => {
        givenRequestWithStatus('OPEN');
        const hash = Hash.of("test");
        request.addFile({
            name: "name",
            submitter: VERIFIED_ISSUER,
            hash,
            cid: "cid",
            contentType: "text/plain",
            nature: "nature",
            restrictedDelivery: false,
            size: 4,
        }, "MANUAL_BY_USER");
        request.requestFileReview(hash);
        request.acceptFile(hash);
        request.prePublishOrAcknowledgeFile(hash, SUBMITTER);

        request.preAcknowledgeFile(hash, OWNER_ACCOUNT);
        request.preAcknowledgeFile(hash, VERIFIED_ISSUER);
        expect(request.getFileOrThrow(hash).lifecycle?.status).toBe("ACKNOWLEDGED");
        request.cancelPreAcknowledgeFile(hash, VERIFIED_ISSUER);
        expect(request.getFileOrThrow(hash).lifecycle?.status).toBe("PUBLISHED");
    });

    it("requester cannot remove accepted file", () => {
        const hash = givenRequestWithAcceptedFile();
        expect(() => request.removeFile(SUBMITTER, hash)).toThrowError("Item removal not allowed");
    });

    it("owner cannot remove accepted file", () => {
        const hash = givenRequestWithAcceptedFile();
        expect(() => request.removeFile(ALICE_ACCOUNT, hash)).toThrowError("Item removal not allowed");
    });
});

function givenRequestWithAcceptedFile() {
    givenRequestWithStatus("OPEN");
    const hash = Hash.of("content");
    request.addFile({
        hash,
        name: "test.txt",
        restrictedDelivery: false,
        size: 7,
        submitter: SUBMITTER,
        nature: "Nature",
    }, "MANUAL_BY_USER");
    request.requestFileReview(hash);
    request.acceptFile(hash);
    return hash;
}

const hash1 = Hash.of("hash1");
const hash2 = Hash.of("hash2");

function givenClosedCollectionLocWithFile(hash: Hash) {
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
    }, "MANUAL_BY_OWNER");
    request.close(moment());
}

describe("LocRequestAggregateRoot (synchronization)", () => {

    it("sets metadata item timestamp", () => {
        givenRequestWithStatus("OPEN")
        const dataName = "data-1";
        const dataNameHash = Hash.of(dataName);
        whenAddingMetadata([{
            name: dataName,
            value: "value-1",
            submitter: SUBMITTER,
        }], "MANUAL_BY_OWNER")
        const addedOn = moment();
        whenSettingMetadataItemAddedOn(dataNameHash, addedOn);
        thenMetadataItemStatusIs(dataNameHash, "PUBLISHED")
        thenMetadataItemRequiresUpdate(dataNameHash)
        thenExposesMetadataItemByNameHash(dataNameHash, {
            name: dataName,
            nameHash: dataNameHash,
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
            submitter: SUBMITTER,
        }], "MANUAL_BY_OWNER")
        const addedOn = moment();
        whenSettingLinkAddedOn("target-1", addedOn);
        thenLinkStatusIs("target-1", "PUBLISHED");
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
                hash: hash1,
                name: "name1",
                contentType: "text/plain",
                cid: "cid-1234",
                nature: "nature1",
                submitter: SUBMITTER,
                restrictedDelivery: false,
                size: 123,
            },
            {
                hash: hash2,
                name: "name2",
                contentType: "text/plain",
                cid: "cid-4567",
                nature: "nature2",
                submitter: SUBMITTER,
                restrictedDelivery: false,
                size: 123,
            }
        ];
        whenAddingFiles(files, "MANUAL_BY_OWNER");
        const addedOn = moment();
        whenSettingFileAddedOn(hash1, addedOn);
        thenFileStatusIs(hash1, "PUBLISHED")
        thenFileRequiresUpdate(hash1)
        thenExposesFileByHash(hash1, {
            hash: hash1,
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

        const fileHash = Hash.of("hash1");
        request.addFile({
            hash: fileHash,
            name: "name1",
            contentType: "text/plain",
            cid: "1234",
            nature: "nature1",
            submitter: SUBMITTER,
            restrictedDelivery: false,
            size: 123,
        }, "MANUAL_BY_USER");
        expect(request.getFiles(SUBMITTER).length).toBe(1);

        const itemName = "Some name";
        const itemNameHash = Hash.of(itemName);
        request.addMetadataItem({
            name: itemName,
            value: "Some value",
            submitter: SUBMITTER,
        }, "MANUAL_BY_USER");
        expect(request.getMetadataItems(SUBMITTER).length).toBe(1);

        const requesterLinkTarget = new UUID().toString();
        request.addLink({
            target: requesterLinkTarget,
            nature: "Some nature",
            submitter: SUBMITTER,
        }, "MANUAL_BY_USER");

        // User requests review
        request.submit();
        thenRequestStatusIs("REVIEW_PENDING");
        thenFileStatusIs(fileHash, "REVIEW_PENDING");
        thenMetadataItemStatusIs(itemNameHash, "REVIEW_PENDING");
        thenLinkStatusIs(requesterLinkTarget, "REVIEW_PENDING");

        // LLO reviews items
        request.acceptMetadataItem(itemNameHash);
        thenMetadataItemStatusIs(itemNameHash, "REVIEW_ACCEPTED");
        request.rejectFile(fileHash, "Wrong format.");
        thenFileStatusIs(fileHash, "REVIEW_REJECTED");
        request.acceptLink(requesterLinkTarget);
        thenLinkStatusIs(requesterLinkTarget, "REVIEW_ACCEPTED");

        // LLO rejects
        request.reject("See rejected file.", moment());
        thenRequestStatusIs("REVIEW_REJECTED");
        thenMetadataItemStatusIs(itemNameHash, "REVIEW_ACCEPTED");
        thenFileStatusIs(fileHash, "REVIEW_REJECTED");
        thenLinkStatusIs(requesterLinkTarget, "REVIEW_ACCEPTED");

        // User reworks and submits again
        request.rework();
        thenRequestStatusIs("DRAFT");
        thenFileStatusIs(fileHash, "REVIEW_REJECTED");
        thenMetadataItemStatusIs(itemNameHash, "REVIEW_ACCEPTED");
        thenLinkStatusIs(requesterLinkTarget, "REVIEW_ACCEPTED");
        request.removeFile(SUBMITTER, fileHash);
        request.addFile({
            hash: fileHash,
            name: "name1",
            contentType: "text/plain",
            cid: "1234",
            nature: "nature1",
            submitter: SUBMITTER,
            restrictedDelivery: false,
            size: 123,
        }, "MANUAL_BY_USER");
        request.submit();
        thenFileStatusIs(fileHash, "REVIEW_PENDING");
        thenMetadataItemStatusIs(itemNameHash, "REVIEW_ACCEPTED");
        thenLinkStatusIs(requesterLinkTarget, "REVIEW_ACCEPTED");

        // LLO accepts
        request.acceptFile(fileHash);
        thenFileStatusIs(fileHash, "REVIEW_ACCEPTED");
        request.accept(moment());
        thenRequestStatusIs("REVIEW_ACCEPTED");

        // User reworks and submits again
        request.rework();
        request.submit();

        // LLO accepts again
        request.accept(moment());
        thenRequestStatusIs("REVIEW_ACCEPTED");

        // User opens
        request.open(moment(), EMPTY_ITEMS);
        thenRequestStatusIs("OPEN");

        // User publishes items
        request.prePublishOrAcknowledgeFile(fileHash, SUBMITTER);
        request.setFileAddedOn(fileHash, moment()); // Sync
        request.preAcknowledgeFile(fileHash, OWNER_ACCOUNT);
        request.preAcknowledgeFile(fileHash, OWNER_ACCOUNT, moment()); // Sync

        request.prePublishOrAcknowledgeMetadataItem(itemNameHash, SUBMITTER);
        request.setMetadataItemAddedOn(itemNameHash, moment()); // Sync
        request.preAcknowledgeMetadataItem(itemNameHash, OWNER_ACCOUNT);
        request.preAcknowledgeMetadataItem(itemNameHash, OWNER_ACCOUNT, moment()); // Sync

        request.prePublishOrAcknowledgeLink(requesterLinkTarget, SUBMITTER);
        request.setLinkAddedOn(requesterLinkTarget, moment()); // Sync
        request.preAcknowledgeLink(requesterLinkTarget, OWNER_ACCOUNT);
        request.preAcknowledgeLink(requesterLinkTarget, OWNER_ACCOUNT, moment()); // Sync

        // LLO adds other data
        request.addFile({
            hash: hash2,
            name: "name2",
            contentType: "text/plain",
            cid: "1235",
            nature: "nature2",
            submitter: OWNER_ACCOUNT,
            restrictedDelivery: false,
            size: 123,
        }, "MANUAL_BY_OWNER");
        request.prePublishOrAcknowledgeFile(hash2, OWNER_ACCOUNT);
        request.setFileAddedOn(hash2, moment()); // Sync

        const target = new UUID().toString();
        request.addLink({
            nature: "Some link nature",
            target: target,
            submitter: OWNER_ACCOUNT,
        }, "MANUAL_BY_OWNER");
        request.prePublishOrAcknowledgeLink(target, OWNER_ACCOUNT);
        request.setLinkAddedOn(target, moment()); // Sync

        const someOtherName = "Some other name";
        const someOtherNameHash = Hash.of(someOtherName);
        request.addMetadataItem({
            name: someOtherName,
            value: "Some other value",
            submitter: OWNER_ACCOUNT,
        }, "MANUAL_BY_OWNER");
        request.prePublishOrAcknowledgeMetadataItem(someOtherNameHash, OWNER_ACCOUNT);
        request.setMetadataItemAddedOn(someOtherNameHash, moment()); // Sync

        // LLO closes
        request.preClose(false);
        thenRequestStatusIs("CLOSED");
        request.close(moment()); // Sync

        // LLO voids
        request.preVoid("Void reason");
        request.voidLoc(moment()); // Sync
    })

    it("full life-cycle with auto-publish and auto-ack", () => {
        const { itemNameHash, fileHash, requesterLinkTarget } = givenAcceptedLocWithAllAccepted(SUBMITTER);

        request.preOpen(true);
        thenFileStatusIs(fileHash, "PUBLISHED");
        thenMetadataItemStatusIs(itemNameHash, "PUBLISHED");
        thenLinkStatusIs(requesterLinkTarget, "PUBLISHED");
        thenFileAddedOnSet(fileHash, false);
        thenMetadataItemAddedOnSet(itemNameHash, false);
        thenLinkAddedOnSet(requesterLinkTarget, false);
        thenRequestStatusIs("OPEN");
        request.open(moment(), {
            fileHashes: [ fileHash ],
            linkTargets: [ new UUID(requesterLinkTarget) ],
            metadataNameHashes: [ itemNameHash ]
        }); // Sync
        thenFileAddedOnSet(fileHash, true);
        thenMetadataItemAddedOnSet(itemNameHash, true);
        thenLinkAddedOnSet(requesterLinkTarget, true);

        request.preClose(true);
        thenFileStatusIs(fileHash, "ACKNOWLEDGED");
        thenMetadataItemStatusIs(itemNameHash, "ACKNOWLEDGED");
        thenLinkStatusIs(requesterLinkTarget, "ACKNOWLEDGED");
        thenRequestStatusIs("CLOSED");
        request.close(moment()); // Sync
    })

    it("auto-ack fails if not all published", () => {
        givenOpenLocWithAllAccepted(SUBMITTER);
        expect(() => request.preClose(true)).toThrowError("A metadata item was not yet published nor acknowledged");
    })

    it("auto-ack fails if not all acked by verified issuer", () => {
        givenOpenLocWithAllAccepted(VERIFIED_ISSUER);
        expect(() => request.preClose(true)).toThrowError("A metadata item was not yet published nor acknowledged");
    })

    it("auto-ack if all acked by verified issuer", () => {
        const { itemNameHash, fileHash, requesterLinkTarget } = givenOpenLocWithAllAccepted(VERIFIED_ISSUER);

        request.prePublishOrAcknowledgeFile(fileHash, SUBMITTER);
        request.setFileAddedOn(fileHash, moment()); // Sync

        request.prePublishOrAcknowledgeMetadataItem(itemNameHash, SUBMITTER);
        request.setMetadataItemAddedOn(itemNameHash, moment()); // Sync

        request.prePublishOrAcknowledgeLink(requesterLinkTarget, SUBMITTER);
        request.setLinkAddedOn(requesterLinkTarget, moment()); // Sync

        request.preAcknowledgeFile(fileHash, VERIFIED_ISSUER);
        request.preAcknowledgeFile(fileHash, VERIFIED_ISSUER, moment()); // Sync

        request.preAcknowledgeMetadataItem(itemNameHash, VERIFIED_ISSUER);
        request.preAcknowledgeMetadataItem(itemNameHash, VERIFIED_ISSUER, moment()); // Sync

        request.preAcknowledgeLink(requesterLinkTarget, VERIFIED_ISSUER);
        request.preAcknowledgeLink(requesterLinkTarget, VERIFIED_ISSUER, moment()); // Sync

        request.preClose(true);
        thenFileStatusIs(fileHash, "ACKNOWLEDGED");
        thenMetadataItemStatusIs(itemNameHash, "ACKNOWLEDGED");
        thenLinkStatusIs(requesterLinkTarget, "ACKNOWLEDGED");
        thenRequestStatusIs("CLOSED");
    })
})

const REJECT_REASON = "Illegal";
const REJECTED_ON = moment();
const ACCEPTED_ON = moment().add(1, "minute");
const VOID_REASON = "Some good reason";
const VOIDED_ON = moment();

function givenPreVoidedRequest(status: LocRequestStatus) {
    givenRequestWithStatus(status);
    request.voidInfo = {
        reason: VOID_REASON
    }
}

function givenVoidedRequest(status: LocRequestStatus) {
    givenPreVoidedRequest(status);
    request.voidInfo!.voidedOn = VOIDED_ON.toISOString();
}

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

function whenPreOpening(autoPublish: boolean) {
    request.preOpen(autoPublish);
}

function thenRequestStatusIs(expectedStatus: LocRequestStatus) {
    expect(request.status).toBe(expectedStatus);
}

function thenRequestSealIs(expectedSeal: Seal) {
    expect(request.seal?.hash).toEqual(expectedSeal.hash.toHex());
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

async function whenCreatingLoc(metadata: MetadataItemParams[], links: LinkParams[]) {
    const sealService = new Mock<PersonalInfoSealService>();
    const factory = new LocRequestFactory(repository.object(), sealService.object());
    request = await factory.newLoc({
        id: requestId,
        description: locDescription,
        metadata,
        links,
    });
}

async function whenCreatingSofRequest(target: string, nature: string) {
    const sealService = new Mock<PersonalInfoSealService>();
    const factory = new LocRequestFactory(repository.object(), sealService.object());
    request = await factory.newSofRequest({
        id: requestId,
        description: locDescription,
        target,
        nature,
        submitter: SUBMITTER,
    });
}

async function whenLOCreatingOpenLoc() {
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

function thenRequestCreatedWithDescription(description: LocRequestDescription, expectedStatus: LocRequestStatus) {
    expect(request.id).toBe(requestId);
    expect(request.status).toBe(expectedStatus);
    expect(request.getDescription()).toEqual(description);
    expect(request.decisionOn).toBeUndefined();
}

function thenLocCreatedWithMetadata(metadata: MetadataItemParams[], status: ItemStatus) {
    expect(request.metadata?.length).toEqual(metadata.length);
    for (const param of metadata) {
        const nameHash = Hash.of(param.name);
        const metadataItem = request.getMetadataItem(nameHash);
        expect(metadataItem.nameHash).toEqual(nameHash);
        expect(metadataItem.name).toEqual(param.name);
        expect(metadataItem.value).toEqual(param.value);
        expect(metadataItem.submitter.type).toEqual(param.submitter.type);
        expect(metadataItem.submitter.address).toEqual(param.submitter.address);
        expect(metadataItem.status).toEqual(status);
        expect(metadataItem.acknowledgedByOwnerOn).toBeUndefined();
        expect(metadataItem.acknowledgedByVerifiedIssuerOn).toBeUndefined();
    }
}

function thenLocCreatedWithLinks(links: LinkParams[], status: ItemStatus) {
    expect(request.links?.length).toEqual(links.length);
    for (const param of links) {
        const link = request.getLink(param.target);
        expect(link.target).toEqual(param.target);
        expect(link.nature).toEqual(param.nature);
        expect(link.submitter.type).toEqual(param.submitter.type);
        expect(link.submitter.address).toEqual(param.submitter.address);
        expect(link.status).toEqual(status);
        expect(link.acknowledgedByOwnerOn).toBeUndefined();
        expect(link.acknowledgedByVerifiedIssuerOn).toBeUndefined();
    }
}

function whenUpdatingFile(hash: Hash, restrictedDelivery: boolean) {
    request.setFileRestrictedDelivery({ hash, restrictedDelivery });
}

function whenAddingFiles(files: FileParams[], submissionType: SubmissionType) {
    files.forEach(file => request.addFile(file, submissionType));
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

function thenExposesFileByHash(hash: Hash, expectedFile: Partial<FileDescription>) {
    expectSameFiles(request.getFile(hash), expectedFile);
}

function thenHasFile(hash: Hash) {
    expect(request.hasFile(hash)).toBe(true);
}

function whenAddingMetadata(metadata: MetadataItemParams[], submissionType: SubmissionType) {
    metadata.forEach(item => request.addMetadataItem(item, submissionType));
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

function thenExposesMetadataItemByNameHash(nameHash: Hash, expectedMetadataItem: Partial<MetadataItemDescription>) {
    expectSameMetadataItems(request.getMetadataItem(nameHash), expectedMetadataItem)
}

function expectSameMetadataItems(item1: MetadataItemDescription, item2: Partial<MetadataItemDescription>) {
    expect(item1.name).toEqual(item2.name!);
    expect(item1.nameHash).toEqual(item2.nameHash!);
    expect(item1.value).toEqual(item2.value!);
    expect(item1.submitter).toEqual(item2.submitter!);
    if (item1.addedOn === undefined) {
        expect(item2.addedOn).toBeUndefined()
    } else {
        expect(item1.addedOn.isSame(item2.addedOn)).toBeTrue()
    }
}

function thenHasMetadataItem(name: Hash) {
    expect(request.hasMetadataItem(name)).toBeTrue();
}

function thenHasExpectedMetadataIndices() {
    for(let i = 0; i < request.metadata!.length; ++i) {
        expect(request.metadata![i].index).toBe(i);
    }
}

function whenSettingMetadataItemAddedOn(nameHash: Hash, addedOn:Moment) {
    request.setMetadataItemAddedOn(nameHash, addedOn);
}

function whenConfirmingMetadataItem(nameHash: Hash, contributor: SupportedAccountId) {
    request.prePublishOrAcknowledgeMetadataItem(nameHash, contributor);
}

function thenMetadataItemStatusIs(nameHash: Hash, expectedStatus: ItemStatus) {
    expect(request.metadataItem(nameHash)?.status).toEqual(expectedStatus);
}

function thenMetadataItemRequiresUpdate(nameHash: Hash) {
    expect(request.metadataItem(nameHash)?._toUpdate).toBeTrue();
}

function thenMetadataIsVisibleToRequester(name: string) {
    expect(request.getMetadataItems(SUBMITTER).length).toEqual(1);
    expect(request.getMetadataItems(SUBMITTER)[0].name).toEqual(name);
}

function whenSettingFileAddedOn(hash: Hash, addedOn:Moment) {
    request.setFileAddedOn(hash, addedOn);
}

function whenConfirmingFile(hash: Hash, contributor: SupportedAccountId) {
    request.prePublishOrAcknowledgeFile(hash, contributor);
}

function thenFileStatusIs(hash: Hash, status: ItemStatus) {
    expect(request.files?.find(file => file.hash === hash.toHex())?.status).toEqual(status)
}

function thenFileRequiresUpdate(hash: Hash) {
    expect(request.files?.find(file => file.hash === hash.toHex())?._toUpdate).toBeTrue();
}

function thenFileIsVisibleToRequester(hash: Hash) {
    expect(request.getFiles(SUBMITTER).length).toEqual(1);
    expect(request.getFiles(SUBMITTER)[0].hash).toEqual(hash);
}

function whenSettingLinkAddedOn(target: string, addedOn:Moment) {
    request.setLinkAddedOn(target, addedOn);
}

function whenConfirmingLink(target: string, contributor: SupportedAccountId) {
    request.prePublishOrAcknowledgeLink(target, contributor);
}

function thenLinkStatusIs(target: string, expectedStatus: ItemStatus) {
    expect(request.link(target)?.status).toEqual(expectedStatus);
}

function thenLinkRequiresUpdate(target: string) {
    expect(request.link(target)?._toUpdate).toBeTrue();
}

function whenOpening(locCreatedDate: Moment) {
    request.open(locCreatedDate, EMPTY_ITEMS);
}

function thenExposesLocCreatedDate(expectedDate: Moment) {
    expect(request.getLocCreatedDate().isSame(expectedDate)).toBe(true);
}

function whenRemovingMetadataItem(remover: SupportedAccountId, nameHash: Hash) {
    request.removeMetadataItem(remover, nameHash);
}

function whenRemovingLink(remover: SupportedAccountId, target: string) {
    request.removeLink(remover, target);
}

function whenRemovingFile(remover: SupportedAccountId, hash: Hash) {
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

function whenAddingLinks(links: LinkParams[], submissionType: SubmissionType) {
    links.forEach(link => request.addLink(link, submissionType));
}

function thenExposesLinks(expectedLinks: Partial<LinkDescription>[]) {
    request.getLinks().forEach((link, index) => {
        expect(link.target).toBe(expectedLinks[index].target!);
        expect(link.nature).toBe(expectedLinks[index].nature!);
        expect(link.submitter).toEqual(expectedLinks[index].submitter!);
        if (link.addedOn === undefined) {
            expect(expectedLinks[index].addedOn).not.toBeDefined()
        } else {
            expect(link.addedOn.isSame(expectedLinks[index].addedOn)).toBe(true);
        }
    });
}

function thenExposesLinkByTarget(target: string, expectedLink: Partial<LinkDescription>) {
    expectSameLinks(request.getLink(target), expectedLink)
}

function expectSameLinks(item1: LinkDescription, item2: Partial<LinkDescription>) {
    expect(item1.target).toEqual(item2.target!);
    expect(item1.nature).toEqual(item2.nature!);
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
    request.preClose(false);
}

function whenPreVoiding(reason: string) {
    request.preVoid(reason);
}

function whenCancelingPreVoid() {
    request.cancelPreVoid();
}

function thenVoidInfoIs(expected: VoidInfo | undefined) {
    const voidInfo = request.getVoidInfo();
    if (expected) {
        expect(voidInfo).toBeDefined();
        expect(voidInfo!.reason).toEqual(expected.reason);
        if (expected.voidedOn !== null) {
            expect(voidInfo!.voidedOn).toBeDefined();
            expect(voidInfo!.voidedOn!.isSame(expected.voidedOn)).toBe(true);
        } else {
            expect(voidInfo!.voidedOn).toBeNull();
        }
    } else {
        expect(voidInfo).toBeNull();
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

async function expectAsyncToThrow(func: () => Promise<void>, message?: string) {
    try {
        await func();
        expect(true).toBe(false);
    } catch(e) {
        if (message) {
            expect(`${ e }`).toEqual(`Error: ${ message }`)
        }
    }
}

function thenStatusIs(expectedStatus: LocRequestStatus) {
    expect(request.status).toBe(expectedStatus);
}

function givenAcceptedLocWithAllAccepted(submitter: SupportedAccountId) {
    givenRequestWithStatus("DRAFT");

    const fileHash = Hash.of("hash1");
    request.addFile({
        hash: fileHash,
        name: "name1",
        contentType: "text/plain",
        cid: "1234",
        nature: "nature1",
        submitter,
        restrictedDelivery: false,
        size: 123,
    }, "MANUAL_BY_USER");

    const itemName = "Some name";
    const itemNameHash = Hash.of(itemName);
    request.addMetadataItem({
        name: itemName,
        value: "Some value",
        submitter,
    }, "MANUAL_BY_USER");

    const requesterLinkTarget = new UUID().toString();
    request.addLink({
        target: requesterLinkTarget,
        nature: "Some nature",
        submitter: submitter,
    }, "MANUAL_BY_USER");

    request.submit();

    request.acceptMetadataItem(itemNameHash);
    request.acceptFile(fileHash);
    request.acceptLink(requesterLinkTarget);
    request.accept(moment());

    return { itemNameHash, fileHash, requesterLinkTarget };
}

function givenOpenLocWithAllAccepted(submitter: SupportedAccountId) {
    const items = givenAcceptedLocWithAllAccepted(submitter);

    request.preOpen(false);
    request.open(moment(), EMPTY_ITEMS); // Sync

    return items;
}

function thenFileAddedOnSet(hash: Hash, set: boolean) {
    return request.files?.find(file => file.hash === hash.toHex() && (set && file.lifecycle?.addedOn !== undefined) || (!set && file.lifecycle?.addedOn === undefined)) !== undefined;
}

function thenMetadataItemAddedOnSet(name: Hash, set: boolean) {
    return request.metadata?.find(item => item.nameHash?.equalTo(name) && (set && item.lifecycle?.addedOn !== undefined) || (!set && item.lifecycle?.addedOn === undefined)) !== undefined;
}

function thenLinkAddedOnSet(target: string, set: boolean) {
    return request.links?.find(link => link.target === target && (set && link.lifecycle?.addedOn !== undefined) || (!set && link.lifecycle?.addedOn === undefined)) !== undefined;
}
