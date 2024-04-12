import { Fees, Lgnt, ValidAccountId } from "@logion/node-api";
import moment from "moment";
import {
    TransactionAggregateRoot,
    TransactionFactory,
    TransactionDescription
} from "../../../src/logion/model/transaction.model.js";
import { Block, EmbeddableBlock } from "../../../src/logion/model/block.model.js";
import { DB_SS58_PREFIX } from "../../../src/logion/model/supportedaccountid.model.js";

describe("TransactionAggregateRoot", () => {

    it("provides expected description when successful", () => {
        const transaction = aSuccessfulTransaction();
        const description = transaction.getDescription();
        expect(description.from.getAddress(DB_SS58_PREFIX)).toBe(transaction.from!);
        expect(description.to?.getAddress(DB_SS58_PREFIX)).toBe(transaction.to!);
        expect(description.createdOn).toBe(transaction.createdOn!);
        expect(description.transferValue.toString()).toBe(transaction.transferValue!);
        expect(description.error).toBeUndefined()
    });

    it("provides expected description when not successful", () => {
        const transaction = aNotSuccessfulTransaction();
        const description = transaction.getDescription();
        expect(description.from.getAddress(DB_SS58_PREFIX)).toBe(transaction.from!);
        expect(description.to?.getAddress(DB_SS58_PREFIX)).toBe(transaction.to!);
        expect(description.createdOn).toBe(transaction.createdOn!);
        expect(description.transferValue.toString()).toBe(transaction.transferValue!);
        expect(description.error).toEqual({ section: "aSection", name: "aName", details: "someDetails" })
    });
});

function aSuccessfulTransaction(): TransactionAggregateRoot {
    let transaction = aTransaction();
    transaction.successful = true;
    return transaction;
}

function aNotSuccessfulTransaction(): TransactionAggregateRoot {
    let transaction = aTransaction();
    transaction.successful = false;
    transaction.errorSection = "aSection";
    transaction.errorName = "aName";
    transaction.errorDetails = "someDetails";
    return transaction;
}

function aTransaction(): TransactionAggregateRoot {
    let transaction = new TransactionAggregateRoot();
    transaction.block = EmbeddableBlock.from(Block.soloBlock(1n));
    transaction.extrinsicIndex = 1;
    transaction.from = "5FbJzFZxa9VuLmdwBzY1nhS5nRbmFC1YrtCARRo8n94pPrqH";
    transaction.to = "5FgoYarSuwBEW8924ksWt3mDox7fhG7mnzmjRNWgvSiH1kuD";
    transaction.createdOn = moment().toISOString();
    transaction.transferValue = "123456";
    transaction.type = "EXTRINSIC";
    return transaction;
}

describe("TransactionFactory", () => {

    const description: TransactionDescription = {
        id: "some-id",
        block: Block.soloBlock(123456n),
        extrinsicIndex: 5,
        from: ValidAccountId.polkadot("5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW"),
        to: ValidAccountId.polkadot("5H4MvAsobfZ6bBCDyj5dsrWYLrA8HrRzaqa9p61UXtxMhSCY"),
        fees: new Fees({ inclusionFee: Lgnt.fromCanonical(12n) }),
        transferValue: 34n,
        tip: 56n,
        reserved: 78n,
        pallet: "recovery",
        method: "createRecovery",
        createdOn: moment().toISOString(),
        type: "EXTRINSIC",
        hiddenFrom: undefined,
    };

    it("creates expected successful root", () => {
        const extrinsicIndex = 5;

        const successfulDescription = {
            ...description,
            error: undefined
        };
        const transaction = new TransactionFactory().newTransaction(successfulDescription);
        expect(transaction.getDescription()).toEqual(successfulDescription);
        expect(transaction.block?.blockNumber).toBe(description.block.blockNumber.toString());
        expect(transaction.block?.chainType).toBe(description.block.chainType);
        expect(transaction.extrinsicIndex).toBe(extrinsicIndex);
        expect(transaction.successful).toBeTrue();
        expect(transaction.errorName).toBeUndefined();
    });

    it("creates expected not successful root", () => {
        const extrinsicIndex = 5;

        const notSuccessfulDescription = {
            ...description,
            error: { section: "aSection", name: "aName", details: "someDetails" }
        };
        const transaction = new TransactionFactory().newTransaction(notSuccessfulDescription);
        expect(transaction.getDescription()).toEqual(notSuccessfulDescription);
        expect(transaction.block?.blockNumber).toBe(description.block.blockNumber.toString());
        expect(transaction.block?.chainType).toBe(description.block.chainType);
        expect(transaction.extrinsicIndex).toBe(extrinsicIndex);
        expect(transaction.successful).toBeFalse();
        expect(transaction.errorSection).toEqual(notSuccessfulDescription.error.section)
        expect(transaction.errorName).toEqual(notSuccessfulDescription.error.name)
        expect(transaction.errorDetails).toEqual(notSuccessfulDescription.error.details)
    });
});
