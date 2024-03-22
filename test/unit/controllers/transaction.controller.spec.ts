import { ChainType, Fees, Lgnt, LogionNodeApiClass } from "@logion/node-api";
import { PolkadotService, TestApp } from '@logion/rest-api-core';
import request from 'supertest';
import { TransactionController } from '../../../src/logion/controllers/transaction.controller.js';
import { Container } from "inversify";
import { It, Mock } from "moq.ts";
import {
    TransactionRepository,
    TransactionAggregateRoot,
    TransactionDescription
} from "../../../src/logion/model/transaction.model.js";
import { ALICE } from "../../helpers/addresses.js";
import { Block } from "../../../src/logion/model/block.model.js";

describe('TransactionController', () => {

    it('fetchTransactions returns expected list', async () => {
        const app = TestApp.setupApp(TransactionController, mockModelForFetch);

        await request(app)
            .put('/api/transaction')
            .send({ address: ALICE })
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.transactions).toBeDefined();
                expect(response.body.transactions.length).toBe(2);

                const transaction0 = response.body.transactions[0];
                expect(transaction0.id).toBeDefined();
                expect(transaction0.from).toBe(ALICE);
                expect(transaction0.to).toBeUndefined();
                expect(transaction0.pallet).toBe("pallet");
                expect(transaction0.method).toBe("method");
                expect(transaction0.transferValue).toBe("1");
                expect(transaction0.tip).toBe("2");
                expect(transaction0.fees.inclusion).toBe("3");
                expect(transaction0.fees.storage).toBe("4");
                expect(transaction0.fees.legal).toBe("5");
                expect(transaction0.fees.certificate).toBe("6");
                expect(transaction0.fees.total).toBe("18");
                expect(transaction0.reserved).toBe("4");
                expect(transaction0.total).toBe("25");
                expect(transaction0.successful).toBeTrue();

                const transaction1 = response.body.transactions[1];
                expect(transaction1.id).toBeDefined();
                expect(transaction1.from).toBe(ALICE);
                expect(transaction1.to).toBeUndefined();
                expect(transaction1.pallet).toBe("pallet");
                expect(transaction1.method).toBe("method");
                expect(transaction1.transferValue).toBe("1");
                expect(transaction1.tip).toBe("2");
                expect(transaction1.fees.inclusion).toBe("3");
                expect(transaction1.fees.total).toBe("3");
                expect(transaction1.reserved).toBe("4");
                expect(transaction1.total).toBe("9");
                expect(transaction1.successful).toBeFalse();
                expect(transaction1.error.section).toBe("aSection");
                expect(transaction1.error.name).toBe("aName");
                expect(transaction1.error.details).toBe("someDetails");
            });
    });
});

const TIMESTAMP = "2021-06-10T16:25:23.668294";

function transactionDescription(fees: Fees): TransactionDescription {
    return {
        id: "9464ca21-d290-4515-ac4d-80c4fa3f6508",
        block: new Block({
            blockNumber: 42n,
            chainType: "Solo",
        }),
        extrinsicIndex: 1,
        from: ALICE,
        to: null,
        createdOn: TIMESTAMP,
        pallet: "pallet",
        method: "method",
        transferValue: 1n,
        tip: 2n,
        fees: fees,
        reserved: 4n,
        type: "EXTRINSIC"
    };
}

function mockModelForFetch(container: Container): void {
    const polkadotService = new Mock<PolkadotService>();
    const logion = new Mock<LogionNodeApiClass>();
    logion.setup(instance => instance.chainType).returns("Solo");
    polkadotService.setup(instance => instance.readyApi()).returnsAsync(logion.object());
    container.bind(PolkadotService).toConstantValue(polkadotService.object());

    const successfulTransactionFees = new Fees({
        inclusionFee: Lgnt.fromCanonical(3n),
        storageFee: Lgnt.fromCanonical(4n),
        legalFee: Lgnt.fromCanonical(5n),
        certificateFee: Lgnt.fromCanonical(6n),
    });

    const successfulTransaction = new Mock<TransactionAggregateRoot>();
    successfulTransaction.setup(instance => instance.getDescription()).returns(transactionDescription(successfulTransactionFees));

    const failedTransactionFees = new Fees({ inclusionFee: Lgnt.fromCanonical(3n) });
    const failedTransaction = new Mock<TransactionAggregateRoot>();
    failedTransaction.setup(instance => instance.getDescription()).returns({
        ...transactionDescription(failedTransactionFees),
        id: "503649be-9743-4ba4-aeac-d806b81e6cd3",
        error: {
            section: "aSection",
            name: "aName",
            details: "someDetails",
        }
    });

    const repository = new Mock<TransactionRepository>();
    const transactions: TransactionAggregateRoot[] = [ successfulTransaction.object(), failedTransaction.object() ];
    repository.setup(instance => instance.findBy(
        It.Is<{ address: string, chainType: ChainType }>(
            spec => spec.address === ALICE && spec.chainType === "Solo"
        )
    )).returns(Promise.resolve(transactions));

    container.bind(TransactionRepository).toConstantValue(repository.object());
}
