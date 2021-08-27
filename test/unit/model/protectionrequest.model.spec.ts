import { v4 as uuid } from 'uuid';
import moment from 'moment';

import {
    ProtectionRequestDescription,
    ProtectionRequestFactory,
    ProtectionRequestAggregateRoot,
} from '../../../src/logion/model/protectionrequest.model';
import { ALICE, BOB } from '../../../src/logion/model/addresses.model';

describe('ProtectionRequestFactoryTest', () => {

    it('createsPendingRequests', async () => {
        const result = newProtectionRequestUsingFactory();

        expect(result.id!).toBe(id);
        expect(result.getDescription()).toEqual(description);
        expect(result.status).toBe('PENDING');
        expect(result.decisions!.length).toBe(2);
        expect(result.decisions![0].status).toBe('PENDING');
        expect(result.decisions![0].legalOfficerAddress).toMatch(new RegExp(ALICE + "|" + BOB));
        expect(result.decisions![1].status).toBe('PENDING');
        expect(result.decisions![1].legalOfficerAddress).toMatch(new RegExp(ALICE + "|" + BOB));
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

        const bobDecision = request.decisions!.find(decision => decision.legalOfficerAddress === BOB)!;
        expect(bobDecision.decisionOn).not.toBeDefined();
        expect(bobDecision.status).toBe('PENDING');
    });

    it('rejects', async () => {
        const request = newProtectionRequestUsingFactory();
        const decisionOn = moment();
        const reason = "Because.";

        request.reject(BOB, reason, decisionOn);

        const bobDecision = request.decisions!.find(decision => decision.legalOfficerAddress === BOB)!;
        expect(bobDecision.decisionOn).toBe(decisionOn.toISOString());
        expect(bobDecision.status).toBe('REJECTED');

        const aliceDecision = request.decisions!.find(decision => decision.legalOfficerAddress === ALICE)!;
        expect(aliceDecision.decisionOn).not.toBeDefined();
        expect(aliceDecision.status).toBe('PENDING');
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
        request.reject(BOB, "", decisionOn);

        expect(() => request.reject(BOB, "", decisionOn)).toThrowError();
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
const legalOfficerAddresses = [ ALICE, BOB ];

function newProtectionRequestUsingFactory(): ProtectionRequestAggregateRoot {
    const factory = new ProtectionRequestFactory();
    return factory.newProtectionRequest({
        id,
        description,
        legalOfficerAddresses
    });
}
