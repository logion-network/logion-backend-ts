import { v4 as uuid } from 'uuid';
import moment from 'moment';

import {
    ProtectionRequestDescription,
    ProtectionRequestFactory,
    ProtectionRequestAggregateRoot, ProtectionRequestStatus,
} from '../../../src/logion/model/protectionrequest.model';
import { BOB, CHARLY, ALICE } from '../../helpers/addresses';

describe('ProtectionRequestFactoryTest', () => {

    it('createsPendingRequests', async () => {
        const result = newProtectionRequestUsingFactory();

        expect(result.id!).toBe(id);
        expect(result.getDescription()).toEqual(description);
        expect(result.status).toBe('PENDING');
    });
});

describe('ProtectionRequestAggregateRootTest', () => {

    it('accepts', async () => {
        const request = newProtectionRequestUsingFactory();
        const decisionOn = moment();
        const locId = "locId";

        request.accept(decisionOn, locId);

        expect(request.status).toBe('ACCEPTED');
        expect(request.decision!.decisionOn).toBe(decisionOn.toISOString());
        expect(request.decision!.locId).toBe(locId);
    });

    it('rejects', async () => {
        const request = newProtectionRequestUsingFactory();
        const decisionOn = moment();
        const reason = "Because.";

        request.reject(reason, decisionOn);

        expect(request.status).toBe('REJECTED');
        expect(request.decision!.decisionOn).toBe(decisionOn.toISOString());
    });

    it('fails on re-accept', async () => {
        const request = newProtectionRequestUsingFactory();
        const decisionOn = moment();
        const locId = "locId";
        request.accept(decisionOn, locId);

        expect(() => request.accept(decisionOn, locId)).toThrowError();
    });

    it('fails on re-reject', async () => {
        const request = newProtectionRequestUsingFactory();
        const decisionOn = moment();
        request.reject("", decisionOn);

        expect(() => request.reject("", decisionOn)).toThrowError();
    });

    it("resubmit", () => {
        const request = newProtectionRequestUsingFactory("REJECTED");
        request.resubmit();
        expect(request.status).toEqual("PENDING")
    });

    it("cancels a pending protection request ", () => {
        const request = newProtectionRequestUsingFactory();
        request.cancel();
        expect(request.status).toEqual("CANCELLED")
    });

    it("cancels a rejected protection request", () => {
        const request = newProtectionRequestUsingFactory("REJECTED");
        request.cancel();
        expect(request.status).toEqual("REJECTED_CANCELLED")
    });

    it("cancels an accepted protection request ", () => {
        const request = newProtectionRequestUsingFactory("ACCEPTED");
        request.cancel();
        expect(request.status).toEqual("ACCEPTED_CANCELLED")
    });

    it("updates", () => {
        const request = newProtectionRequestUsingFactory();
        request.updateOtherLegalOfficer(CHARLY);
        expect(request.otherLegalOfficerAddress).toEqual(CHARLY);
    });
});


const id = uuid();
const description: ProtectionRequestDescription = {
    requesterAddress: "5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW",
    legalOfficerAddress: ALICE,
    otherLegalOfficerAddress: BOB,
    userIdentity: {
        email: "john.doe@logion.network",
        firstName: "John",
        lastName: "Doe",
        phoneNumber: "+1234",
    },
    userPostalAddress: {
        line1: "Place de le République Française, 10",
        line2: "boite 15",
        postalCode: "4000",
        city: "Liège",
        country: "Belgium",
    },
    createdOn: moment().toISOString(),
    isRecovery: false,
    addressToRecover: null,
};

function newProtectionRequestUsingFactory(status?: ProtectionRequestStatus): ProtectionRequestAggregateRoot {
    const factory = new ProtectionRequestFactory();
    const protectionRequest = factory.newProtectionRequest({
        id,
        description,
    });
    if (status) {
        protectionRequest.status = status;
    }
    return protectionRequest;
}
