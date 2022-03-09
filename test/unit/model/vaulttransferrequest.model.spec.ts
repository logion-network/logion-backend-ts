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
        const locId = "locId";
        request.accept(decisionOn);

        expect(() => request.accept(decisionOn)).toThrowError();
    });

    it('fails on re-reject', async () => {
        const request = newVaultTransferRequestUsingFactory();
        const decisionOn = moment();
        request.reject("", decisionOn);

        expect(() => request.reject("", decisionOn)).toThrowError();
    });
});

const description: VaultTransferRequestDescription = {
    id: uuid(),
    requesterAddress: "5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW",
    destination: "5EBxoSssqNo23FvsDeUxjyQScnfEiGxJaNwuwqBH2Twe35BX",
    createdOn: moment().toISOString(),
    amount: 10000n,
    call: '0x0303005e017e03e2ee7a0a97e2e5df5cd902aa0b976d65eac998889ea40992efc3d254070010a5d4e8',
    timepoint: {
        blockNumber: 42n,
        extrinsicIndex: 1
    }
};

function newVaultTransferRequestUsingFactory(): VaultTransferRequestAggregateRoot {
    const factory = new VaultTransferRequestFactory();
    return factory.newVaultTransferRequest(description);
}
