import { v4 as uuid } from 'uuid';
import moment from 'moment';

import {
    VaultTransferRequestDescription,
    VaultTransferRequestFactory,
    VaultTransferRequestAggregateRoot,
} from '../../../src/logion/model/vaulttransferrequest.model';

describe('VaultTransferRequestFactory', () => {

    it('createsPendingRequests', async () => {
        const result = newVaultTransferRequestUsingFactory();
        expect(result.getDescription()).toEqual(description);
        expect(result.status).toBe('PENDING');
    });
});

describe('VaultTransferRequestAggregateRoot', () => {

    it('accepts', async () => {
        const request = newVaultTransferRequestUsingFactory();
        const decisionOn = moment();

        request.accept(decisionOn);

        expect(request.status).toBe('ACCEPTED');
        expect(request.decision!.decisionOn).toBe(decisionOn.toISOString());
    });

    it('rejects', async () => {
        const request = newVaultTransferRequestUsingFactory();
        const decisionOn = moment();
        const reason = "Because.";

        request.reject(reason, decisionOn);

        expect(request.status).toBe('REJECTED');
        expect(request.decision!.decisionOn).toBe(decisionOn.toISOString());
    });

    it('fails on re-accept', async () => {
        const request = newVaultTransferRequestUsingFactory();
        const decisionOn = moment();
        request.accept(decisionOn);

        expect(() => request.accept(decisionOn)).toThrowError();
    });

    it('fails on re-reject', async () => {
        const request = newVaultTransferRequestUsingFactory();
        const decisionOn = moment();
        request.reject("", decisionOn);

        expect(() => request.reject("", decisionOn)).toThrowError();
    });

    it('cancels', async () => {
        const request = newVaultTransferRequestUsingFactory();
        const decisionOn = moment();

        request.cancel(decisionOn);

        expect(request.status).toBe('CANCELLED');
        expect(request.decision!.decisionOn).toBe(decisionOn.toISOString());
    });

    it('fails on re-cancel', async () => {
        const request = newVaultTransferRequestUsingFactory();
        const decisionOn = moment();
        request.cancel(decisionOn);

        expect(() => request.cancel(decisionOn)).toThrowError();
    });

    it('cancels after rejection', async () => {
        const request = newVaultTransferRequestUsingFactory();
        const rejectDecisionOn = moment();
        request.reject("Some reason.", rejectDecisionOn);

        const decisionOn = rejectDecisionOn.clone().add(1, "hour");
        request.cancel(decisionOn);

        expect(request.status).toBe('REJECTED_CANCELLED');
        expect(request.decision!.decisionOn).toBe(decisionOn.toISOString());
    });

    it('resubmits after rejection', async () => {
        const request = newVaultTransferRequestUsingFactory();
        const rejectDecisionOn = moment();
        request.reject("Some reason.", rejectDecisionOn);

        request.resubmit();

        expect(request.status).toBe('PENDING');
        expect(request.decision!.decisionOn).toBeUndefined();
        expect(request.decision!.rejectReason).toBeUndefined();
    });
});

const description: VaultTransferRequestDescription = {
    id: uuid(),
    requesterAddress: "5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW",
    destination: "5EBxoSssqNo23FvsDeUxjyQScnfEiGxJaNwuwqBH2Twe35BX",
    createdOn: moment().toISOString(),
    amount: 10000n,
    timepoint: {
        blockNumber: 42n,
        extrinsicIndex: 1
    },
    isRecovery: true
};

function newVaultTransferRequestUsingFactory(): VaultTransferRequestAggregateRoot {
    const factory = new VaultTransferRequestFactory();
    return factory.newVaultTransferRequest(description);
}
