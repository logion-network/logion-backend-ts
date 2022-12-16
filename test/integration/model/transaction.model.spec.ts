import { TestDb } from "@logion/rest-api-core";
import {
    TransactionAggregateRoot,
    TransactionRepository,
} from "../../../src/logion/model/transaction.model.js";
import moment from "moment";

const { connect, disconnect, checkNumOfRows, executeScript } = TestDb;

describe('TransactionRepository', () => {

    beforeAll(async () => {
        await connect([TransactionAggregateRoot]);
        await executeScript("test/integration/model/transactions.sql");
        repository = new TransactionRepository();
    });

    let repository: TransactionRepository;

    afterAll(async () => {
        await disconnect();
    });

    it("finds failed transaction of when 5DPPdRwkgigKt2L7jxRfAoV4tfS89KgXsx47Wk3Kat5K6xPg when sender", async () => {
        const transactions = await repository.findByAddress("5DPPdRwkgigKt2L7jxRfAoV4tfS89KgXsx47Wk3Kat5K6xPg");
        expect(transactions.length).toBe(1);
    });

    it("finds only successful transactions of 5H4MvAsobfZ6bBCDyj5dsrWYLrA8HrRzaqa9p61UXtxMhSCY when recipient", async () => {
        const transactions = await repository.findByAddress("5H4MvAsobfZ6bBCDyj5dsrWYLrA8HrRzaqa9p61UXtxMhSCY");
        expect(transactions.length).toBe(1);
    });

    it("finds transactions of 5CSbpCKSTvZefZYddesUQ9w6NDye2PHbf12MwBZGBgzGeGoo", async () => {
        const transactions = await repository.findByAddress("5CSbpCKSTvZefZYddesUQ9w6NDye2PHbf12MwBZGBgzGeGoo");
        expect(transactions.length).toBe(1);
    });

    it("finds no transaction for Unknown", async () => {
        const transactions = await repository.findByAddress("Unknown");
        expect(transactions.length).toBe(0);
    });

    it("saves transaction", async () => {
        // Given
        const transaction = new TransactionAggregateRoot();
        transaction.blockNumber = "3";
        transaction.extrinsicIndex = 1;
        transaction.from = "from-address";
        transaction.transferValue = "1";
        transaction.tip = "1";
        transaction.fee = "1";
        transaction.reserved = "1";
        transaction.pallet = "balances";
        transaction.method = "transfer";
        transaction.createdOn = moment().toISOString()
        transaction.successful = true;
        // When
        await repository.save(transaction)
        // Then
        await checkNumOfRows(`SELECT *
                              FROM transaction
                              WHERE block_number = ${ transaction.blockNumber }
                                AND extrinsic_index = ${ transaction.extrinsicIndex }`, 1)
    })
});
