import { setupApp } from '../../helpers/testapp';
import request from 'supertest';

import { TransactionController } from '../../../src/logion/controllers/transaction.controller';

describe('TransactionController', () => {

    it('fetchTransactions returns empty list', async () => {
        const app = setupApp(TransactionController, () => {});

        await request(app)
            .put('/api/transaction')
            .send({})
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.transactions).toBeDefined();
                expect(response.body.transactions.length).toBe(0);
            });
    });
});
