import { TestDb } from "@logion/rest-api-core";
import {
    TransactionAggregateRoot,
    TransactionRepository,
} from "../../../src/logion/model/transaction.model.js";
import moment from "moment";
import { EmbeddableFees } from "../../../src/logion/model/fees.js";
import { Block, EmbeddableBlock } from "../../../src/logion/model/block.model.js";

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

    it("finds transactions of 5DPPdRwkgigKt2L7jxRfAoV4tfS89KgXsx47Wk3Kat5K6xPg", async () => {
        const transactions = await repository.findBy({ address: "5DPPdRwkgigKt2L7jxRfAoV4tfS89KgXsx47Wk3Kat5K6xPg", chainType: "Solo" });
        expect(transactions.length).toBe(2); // 2 and 3 in SQL file
    });

    it("finds transactions of 5H4MvAsobfZ6bBCDyj5dsrWYLrA8HrRzaqa9p61UXtxMhSCY", async () => {
        const transactions = await repository.findBy({ address: "5H4MvAsobfZ6bBCDyj5dsrWYLrA8HrRzaqa9p61UXtxMhSCY", chainType: "Solo" });
        expect(transactions.length).toBe(2); // 1 and 4 in SQL file
    });

    it("finds transactions of 5CSbpCKSTvZefZYddesUQ9w6NDye2PHbf12MwBZGBgzGeGoo", async () => {
        const transactions = await repository.findBy({ address: "5CSbpCKSTvZefZYddesUQ9w6NDye2PHbf12MwBZGBgzGeGoo", chainType: "Solo" });
        expect(transactions.length).toBe(1); // 1 in SQL file
    });

    it("finds no transaction for Unknown", async () => {
        const transactions = await repository.findBy({ address: "Unknown", chainType: "Solo" });
        expect(transactions.length).toBe(0);
    });

    it("saves transaction", async () => {
        // Given
        const transaction = new TransactionAggregateRoot();
        transaction.block = EmbeddableBlock.from(Block.soloBlock(4n)),
        transaction.extrinsicIndex = 1;
        transaction.from = "from-address";
        transaction.transferValue = "1";
        transaction.tip = "1";
        transaction.fees = new EmbeddableFees();
        transaction.fees.inclusionFee = "1";
        transaction.reserved = "1";
        transaction.pallet = "balances";
        transaction.method = "transfer";
        transaction.createdOn = moment().toISOString()
        transaction.successful = true;
        transaction.type = "EXTRINSIC";
        // When
        await repository.save(transaction)
        // Then
        await checkNumOfRows(`SELECT *
                              FROM transaction
                              WHERE block_number = ${ transaction.block.blockNumber }
                                AND chain_type = '${ transaction.block.chainType }'
                                AND extrinsic_index = ${ transaction.extrinsicIndex }`, 1)
    })
});
