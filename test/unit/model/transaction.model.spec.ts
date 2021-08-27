import moment from 'moment';
import { TransactionAggregateRoot, TransactionFactory, TransactionDescription } from "../../../src/logion/model/transaction.model";

describe("TransactionAggregateRoot", () => {

    it("provides expected description", () => {
        const transaction = aTransaction();
        const description = transaction.getDescription();
        expect(description.from).toBe(transaction.from!);
        expect(description.to).toBe(transaction.to!);
        expect(description.createdOn).toBe(transaction.createdOn!);
        expect(description.transferValue.toString()).toBe(transaction.transferValue!);
    });
});

function aTransaction(): TransactionAggregateRoot {
    var transaction = new TransactionAggregateRoot();
    transaction.blockNumber = "1";
    transaction.extrinsicIndex = 1;
    transaction.from = "from";
    transaction.to = "to";
    transaction.createdOn = moment().toISOString();
    transaction.transferValue = "123456";
    return transaction;
}

describe("TransactionFactory", () => {

    it("creates expected root", () => {
        const blockNumber = 123456n;
        const extrinsicIndex = 5;
        const description: TransactionDescription = {
            from: "5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW",
            to: "5H4MvAsobfZ6bBCDyj5dsrWYLrA8HrRzaqa9p61UXtxMhSCY",
            fee: 12n,
            transferValue: 34n,
            tip: 56n,
            reserved: 78n,
            pallet: "recovery",
            method: "createRecovery",
            createdOn: moment().toISOString()
        };
        const transaction = new TransactionFactory().newTransaction({
            blockNumber,
            extrinsicIndex,
            description
        });
        expect(transaction.getDescription()).toEqual(description);
        expect(transaction.blockNumber).toBe(blockNumber.toString());
        expect(transaction.extrinsicIndex).toBe(extrinsicIndex);
    });
});
