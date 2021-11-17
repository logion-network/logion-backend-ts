import { v4 as uuid } from "uuid";
import { ALICE } from "../../../src/logion/model/addresses.model";
import moment, { Moment } from "moment";
import {
    LocRequestDescription,
    LocRequestFactory,
    LocRequestAggregateRoot,
    LocRequestStatus,
    FileDescription,
    MetadataItemDescription,
    LinkDescription
} from "../../../src/logion/model/locrequest.model";

describe("LocRequestFactory", () => {

    it("creates LOC request", () => {
        givenRequestId(uuid());
        const description: LocRequestDescription = {
            requesterAddress: "5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW",
            ownerAddress: ALICE,
            description: "Mrs ALice, I want to sell my last art work",
            createdOn: moment().toISOString(),
            userIdentity: undefined,
            locType: 'Transaction'
        };
        givenLocDescription(description);
        whenCreatingLocRequest();
        thenRequestCreatedWithDescription(description);
    });

    it("creates an open LOC", () => {
        givenRequestId(uuid());
        const description: LocRequestDescription = {
            requesterAddress: "5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW",
            ownerAddress: ALICE,
            description: "Mrs ALice, I want to sell my last art work",
            createdOn: moment().toISOString(),
            userIdentity: undefined,
            locType: 'Transaction'
        };
        givenLocDescription(description);
        whenCreatingOpenLoc();
        thenOpenLocCreatedWithDescription(description)
    });
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

    it("adds and exposes files", () => {
        givenRequestWithStatus('OPEN');
        const files: FileDescription[] = [
            {
                hash: "hash1",
                name: "name1",
                contentType: "text/plain",
                oid: 1234
            },
            {
                hash: "hash2",
                name: "name2",
                contentType: "text/plain",
                oid: 4567
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
                oid: 1234
            },
            {
                hash: "hash1",
                name: "name2",
                contentType: "text/plain",
                oid: 4567
            }
        ];
        expect(() => whenAddingFiles(files)).toThrowError();
    });

    it("adds and exposes metadata", () => {
        givenRequestWithStatus('OPEN');
        const metadata: MetadataItemDescription[] = [
            {
                name: "name1",
                value: "value1",
                addedOn: moment(),
            },
            {
                name: "name2",
                value: "value2",
                addedOn: moment(),
            }
        ];
        whenAddingMetadata(metadata);
        thenExposesMetadata(metadata);
    });

    it("sets LOC created date", () => {
        givenRequestWithStatus('OPEN');
        const locCreatedDate = moment();
        whenSettingLocCreatedDate(locCreatedDate);
        thenExposesLocCreatedDate(locCreatedDate);
    });

    it("removes previously added files", () => {
        givenRequestWithStatus('OPEN');
        const files: FileDescription[] = [
            {
                hash: "hash1",
                name: "name1",
                contentType: "text/plain",
                oid: 1234
            },
            {
                hash: "hash2",
                name: "name2",
                contentType: "text/plain",
                oid: 4567
            }
        ];
        whenAddingFiles(files);
        whenRemovingFile("hash1");
        thenReturnedRemovedFile(files[0]);

        const newFiles: FileDescription[] = [
            {
                hash: "hash2",
                name: "name2",
                contentType: "text/plain",
                oid: 4567
            }
        ];
        thenExposesFiles(newFiles);
        thenExposesFileByHash("hash2", newFiles[0]);
        thenHasFile("hash2");
        thenHasExpectedFileIndices();
    });

    it("adds and exposes links", () => {
        givenRequestWithStatus('OPEN');
        const links: LinkDescription[] = [
            {
                target: "value1",
                addedOn: moment(),
            },
            {
                target: "value2",
                addedOn: moment(),
            }
        ];
        whenAddingLinks(links);
        thenExposesLinks(links);
    });
});

const REJECT_REASON = "Illegal";
const REJECTED_ON = moment();
const ACCEPTED_ON = moment().add(1, "minute");

function givenRequestWithStatus(status: LocRequestStatus) {
    request = new LocRequestAggregateRoot();
    request.status = status;
    request.files = [];
    request.metadata = [];
    request.links = [];
}

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

function whenCreatingLocRequest() {
    createdLocRequest = factory.newLocRequest({
        id: requestId,
        description: locDescription
    });
}

function whenCreatingOpenLoc() {
    createdLocRequest = factory.newOpenLoc({
        id: requestId,
        description: locDescription
    });
}

const factory = new LocRequestFactory();

let createdLocRequest: LocRequestAggregateRoot;

function thenRequestCreatedWithDescription(description: LocRequestDescription) {
    expect(createdLocRequest.id).toBe(requestId);
    expect(createdLocRequest.status).toBe('REQUESTED');
    expect(createdLocRequest.getDescription()).toEqual(description);
    expect(createdLocRequest.decisionOn).toBeUndefined();
}

function thenOpenLocCreatedWithDescription(description: LocRequestDescription) {
    expect(createdLocRequest.id).toBe(requestId);
    expect(createdLocRequest.status).toBe('OPEN');
    expect(createdLocRequest.getDescription()).toEqual(description);
    expect(createdLocRequest.decisionOn).toBeDefined();
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
        expect(item.addedOn.isSame(expectedMetadata[index].addedOn)).toBe(true);
    });
}

function whenSettingLocCreatedDate(locCreatedDate: Moment) {
    request.setLocCreatedDate(locCreatedDate);
}

function thenExposesLocCreatedDate(expectedDate: Moment) {
    expect(request.getLocCreatedDate().isSame(expectedDate)).toBe(true);
}

function whenRemovingFile(hash: string) {
    removedFile = request.removeFile(hash);
}

let removedFile: FileDescription;

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
        expect(link.addedOn.isSame(expectedLinks[index].addedOn)).toBe(true);
    });
}
