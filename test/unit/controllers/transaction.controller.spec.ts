import { setupApp } from '../../helpers/testapp';
import request from 'supertest';
import { TransactionController } from '../../../src/logion/controllers/transaction.controller';
import { Container } from "inversify";
import { Mock } from "moq.ts";
import { TransactionRepository, TransactionAggregateRoot } from "../../../src/logion/model/transaction.model";
import { ALICE } from "../../../src/logion/model/addresses.model";

describe('TransactionController', () => {

    it('fetchTransactions returns expected list', async () => {
        const app = setupApp(TransactionController, mockModelForFetch);

        await request(app)
            .put('/api/transaction')
            .send({ address: ALICE })
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.transactions).toBeDefined();
                expect(response.body.transactions.length).toBe(1);
                expect(response.body.transactions[0].from).toBe(ALICE);
                expect(response.body.transactions[0].to).toBeUndefined();
                expect(response.body.transactions[0].pallet).toBe("pallet");
                expect(response.body.transactions[0].method).toBe("method");
                expect(response.body.transactions[0].transferValue).toBe("1");
                expect(response.body.transactions[0].tip).toBe("2");
                expect(response.body.transactions[0].fee).toBe("3");
                expect(response.body.transactions[0].reserved).toBe("4");
                expect(response.body.transactions[0].total).toBe("10");
            });
    });
});

const TIMESTAMP = "2021-06-10T16:25:23.668294";

function mockModelForFetch(container: Container): void {

    const transaction = new Mock<TransactionAggregateRoot>();
    transaction.setup(instance => instance.getDescription())
        .returns({
            from: ALICE,
            to: null,
            createdOn: TIMESTAMP,
            pallet: "pallet",
            method: "method",
            transferValue: 1n,
            tip: 2n,
            fee: 3n,
            reserved: 4n,
            }
        );
    const repository = new Mock<TransactionRepository>();
    const transactions: TransactionAggregateRoot[] = [ transaction.object() ];
    repository.setup(instance => instance.findByAddress(ALICE))
        .returns(Promise.resolve(transactions));

    container.bind(TransactionRepository).toConstantValue(repository.object());
}
