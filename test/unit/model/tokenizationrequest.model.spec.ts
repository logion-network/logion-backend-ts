import moment, { Moment } from 'moment';
import { v4 as uuid } from 'uuid';
import { ALICE } from '../../../src/logion/model/addresses.model';

import {
    TokenizationRequestAggregateRoot,
    TokenizationRequestStatus,
    EmbeddableAssetDescription,
    AssetDescription,
    TokenizationRequestFactory,
    TokenizationRequestDescription,
} from "../../../src/logion/model/tokenizationrequest.model";

describe("TokenizationRequestAggregateRoot", () => {

    it("rejects pending", () => {
        givenRequestWithStatus('PENDING');
        whenRejecting(REJECT_REASON, REJECTED_ON);
        thenRequestStatusIs('REJECTED');
        thenRequestRejectReasonIs(REJECT_REASON);
        thenDecisionOnIs(REJECTED_ON);
    });

    it("accepts pending", () => {
        givenRequestWithStatus('PENDING');
        whenAccepting(ACCEPTED_ON);
        thenRequestStatusIs('ACCEPTED');
        thenRequestRejectReasonIs(undefined);
        thenDecisionOnIs(ACCEPTED_ON);
    });

    it("fails reject given already accepted", () => {
        givenRequestWithStatus('ACCEPTED');
        expect(() => whenRejecting(REJECT_REASON, REJECTED_ON)).toThrowError();
    });

    it("fails accept given already accepted", () => {
        givenRequestWithStatus('ACCEPTED');
        expect(() => whenAccepting(ACCEPTED_ON)).toThrowError();
    });

    it("fails reject given already rejected", () => {
        givenRequestWithStatus('REJECTED');
        expect(() => whenRejecting(REJECT_REASON, REJECTED_ON)).toThrowError();
    });

    it("fails accept given already REJECTED", () => {
        givenRequestWithStatus('REJECTED');
        expect(() => whenAccepting(ACCEPTED_ON)).toThrowError();
    });

    it("returns undefined asset description given none", () => {
        givenRequestWithEmbeddableAssetDescription(undefined);
        expect(request.getAssetDescription()).toBeUndefined();
    });

    it("returns undefined asset description given empty", () => {
        givenRequestWithEmbeddableAssetDescription(new EmbeddableAssetDescription());
        expect(request.getAssetDescription()).toBeUndefined();
    });

    it("gives correct asset description", () => {
        givenRequestWithStatus('ACCEPTED');
        whenSettingAssetDescription({
            assetId: "assetId",
            decimals: 10,
        });
        const assetDescription = request.getAssetDescription();
        expect(assetDescription).toBeDefined();
        expect(assetDescription?.assetId).toBe("assetId")
        expect(assetDescription?.decimals).toBe(10)
    });
});

const REJECT_REASON = "Illegal";
const REJECTED_ON = moment();
const ACCEPTED_ON = moment().add(1, "minute");

function givenRequestWithStatus(status: TokenizationRequestStatus) {
    request = new TokenizationRequestAggregateRoot();
    request.status = status;
}

let request: TokenizationRequestAggregateRoot;

function whenRejecting(rejectReason: string, rejectedOn: Moment) {
    request.reject(rejectReason, rejectedOn);
}

function whenAccepting(acceptedOn: Moment) {
    request.accept(acceptedOn);
}

function thenRequestStatusIs(expectedStatus: TokenizationRequestStatus) {
    expect(request.status).toBe(expectedStatus);
}

function thenRequestRejectReasonIs(rejectReason: string | undefined) {
    expect(request.rejectReason).toBe(rejectReason);
}

function thenDecisionOnIs(rejectedOn: Moment) {
    expect(request.decisionOn).toEqual(rejectedOn.toISOString());
}

function givenRequestWithEmbeddableAssetDescription(description: EmbeddableAssetDescription | undefined) {
    request = new TokenizationRequestAggregateRoot();
    request.assetDescription = description;
}

function whenSettingAssetDescription(description: AssetDescription) {
    request.setAssetDescription(description);
}

describe("TokenizationRequestFactory", () => {

    it("createsPendingRequests", () => {
        givenRequestId(uuid());
        const description = {
            requesterAddress: "5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW",
            legalOfficerAddress: ALICE,
            requestedTokenName: "MYT",
            bars: 1,
            createdOn: moment().toISOString(),
        };
        givenTokenDescription(description);
        whenCreatingTokenizationRequest();
        thenPendingRequestCreatedWithDescription(description);
    });
});

function givenRequestId(value: string) {
    requestId = value;
}

let requestId: string;

function givenTokenDescription(value: TokenizationRequestDescription) {
    tokenDescription = value;
}

let tokenDescription: TokenizationRequestDescription;

function whenCreatingTokenizationRequest() {
    createdTokenizationRequest = factory.newPendingTokenizationRequest({
        id: requestId,
        description: tokenDescription
    });
}

const factory = new TokenizationRequestFactory();

let createdTokenizationRequest: TokenizationRequestAggregateRoot;

function thenPendingRequestCreatedWithDescription(description: TokenizationRequestDescription) {
    expect(createdTokenizationRequest.id).toBe(requestId);
    expect(createdTokenizationRequest.getDescription()).toEqual(description);
    expect(createdTokenizationRequest.getAssetDescription()).toBeUndefined();
}
