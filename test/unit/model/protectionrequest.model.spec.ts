import { v4 as uuid } from 'uuid';
import moment from 'moment';

import {
    ProtectionRequestDescription,
    ProtectionRequestFactory,
    ProtectionRequestAggregateRoot,
} from '../../../src/logion/model/protectionrequest.model';
import { ALICE } from '../../../src/logion/model/addresses.model';

describe('ProtectionRequestFactoryTest', () => {

    it('createsPendingRequests', async () => {
        const result = newProtectionRequestUsingFactory();

        expect(result.id!).toBe(id);
        expect(result.getDescription()).toEqual(description);
        expect(result.status).toBe('PENDING');
        expect(result.decisions!.length).toBe(1);
        expect(result.decisions![0].status).toBe('PENDING');
        expect(result.decisions![0].legalOfficerAddress).toBe(ALICE);
    });
});

describe('ProtectionRequestAggregateRootTest', () => {

    it('accepts', async () => {
        const request = newProtectionRequestUsingFactory();
        const decisionOn = moment();

        request.accept(ALICE, decisionOn);

        const aliceDecision = request.decisions!.find(decision => decision.legalOfficerAddress === ALICE)!;
        expect(aliceDecision.decisionOn).toBe(decisionOn.toISOString());
        expect(aliceDecision.status).toBe('ACCEPTED');
    });

    it('rejects', async () => {
        const request = newProtectionRequestUsingFactory();
        const decisionOn = moment();
        const reason = "Because.";

        request.reject(ALICE, reason, decisionOn);

        const aliceDecision = request.decisions!.find(decision => decision.legalOfficerAddress === ALICE)!;
        expect(aliceDecision.decisionOn).toBe(decisionOn.toISOString());
        expect(aliceDecision.status).toBe('REJECTED');
    });

    it('fails on re-accept', async () => {
        const request = newProtectionRequestUsingFactory();
        const decisionOn = moment();
        request.accept(ALICE, decisionOn);

        expect(() => request.accept(ALICE, decisionOn)).toThrowError();
    });

    it('fails on re-reject', async () => {
        const request = newProtectionRequestUsingFactory();
        const decisionOn = moment();
        request.reject(ALICE, "", decisionOn);

        expect(() => request.reject(ALICE, "", decisionOn)).toThrowError();
    });
});


const id = uuid();
const description: ProtectionRequestDescription = {
    requesterAddress: "5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW",
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
const legalOfficerAddress = ALICE;

function newProtectionRequestUsingFactory(): ProtectionRequestAggregateRoot {
    const factory = new ProtectionRequestFactory();
    return factory.newProtectionRequest({
        id,
        description,
        legalOfficerAddress
    });
}
