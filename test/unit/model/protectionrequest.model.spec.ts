import { v4 as uuid } from 'uuid';
import moment from 'moment';

import {
    ProtectionRequestDescription,
    ProtectionRequestFactory,
    ProtectionRequestAggregateRoot,
} from '../../../src/logion/model/protectionrequest.model';
import { BOB } from '../../helpers/addresses';

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
});


const id = uuid();
const description: ProtectionRequestDescription = {
    requesterAddress: "5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW",
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

function newProtectionRequestUsingFactory(): ProtectionRequestAggregateRoot {
    const factory = new ProtectionRequestFactory();
    return factory.newProtectionRequest({
        id,
        description,
    });
}
