import { v4 as uuid } from "uuid";
import { ALICE } from "../../../src/logion/model/addresses.model";
import moment, { Moment } from "moment";
import {
    LocRequestDescription,
    LocRequestFactory,
    LocRequestAggregateRoot,
    LocRequestStatus
} from "../../../src/logion/model/locrequest.model";

describe("LocRequestFactory", () => {

    it("creates LOC request", () => {
        givenRequestId(uuid());
        const description = {
            requesterAddress: "5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW",
            ownerAddress: ALICE,
            description: "Mrs ALice, I want to sell my last art work",
            createdOn: moment().toISOString(),
            userIdentity: undefined
        };
        givenLocDescription(description);
        whenCreatingLocRequest();
        thenRequestCreatedWithDescription(description);
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
});

const REJECT_REASON = "Illegal";
const REJECTED_ON = moment();
const ACCEPTED_ON = moment().add(1, "minute");

function givenRequestWithStatus(status: LocRequestStatus) {
    request = new LocRequestAggregateRoot();
    request.status = status;
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

const factory = new LocRequestFactory();

let createdLocRequest: LocRequestAggregateRoot;

function thenRequestCreatedWithDescription(description: LocRequestDescription) {
    expect(createdLocRequest.id).toBe(requestId);
    expect(createdLocRequest.status).toBe('REQUESTED');
    expect(createdLocRequest.getDescription()).toEqual(description);
    expect(createdLocRequest.decisionOn).toBeUndefined();
}
