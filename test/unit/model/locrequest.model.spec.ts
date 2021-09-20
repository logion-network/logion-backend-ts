import { v4 as uuid } from "uuid";
import { ALICE } from "../../../src/logion/model/addresses.model";
import moment from "moment";
import {
    LocRequestDescription,
    LocRequestFactory,
    LocRequestAggregateRoot
} from "../../../src/logion/model/locrequest.model";

describe("LocRequestFactory", () => {

    it("createsPendingRequests", () => {
        givenRequestId(uuid());
        const description = {
            requesterAddress: "5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW",
            ownerAddress: ALICE,
            description: "Mrs ALice, I want to sell my last art work",
            createdOn: moment().toISOString(),
        };
        givenLocDescription(description);
        whenCreatingLocRequest();
        thenPendingRequestCreatedWithDescription(description);
    });
});

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

function thenPendingRequestCreatedWithDescription(description: LocRequestDescription) {
    expect(createdLocRequest.id).toBe(requestId);
    expect(createdLocRequest.status).toBe('REQUESTED');
    expect(createdLocRequest.getDescription()).toEqual(description);
}
