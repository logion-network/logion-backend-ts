import { Moment } from "moment";
import { Fees } from "@logion/node-api";
import { TransactionType } from "../model/transaction.model";
import { NULL_FEES } from "../model/fees.js";

export class BlockWithTransactions {

    blockNumber?: bigint = undefined;
    timestamp?: Moment = undefined;
    transactions: Transaction[] = [];

    static builder(): BlockWithTransactionsBuilder {
        return new BlockWithTransactionsBuilder();
    }
}

export class BlockWithTransactionsBuilder {
    private readonly _block: BlockWithTransactions = new BlockWithTransactions();

    blockNumber(blockNumber: bigint) {
        this._block.blockNumber = blockNumber;
        return this;
    }

    timestamp(timestamp: Moment) {
        this._block.timestamp = timestamp;
        return this;
    }

    transactions(transactions: Transaction[]) {
        this._block.transactions = transactions;
        return this;
    }

    build(): BlockWithTransactions {
        return this._block;
    }
}

export interface TransactionError {
    readonly section: string
    readonly name: string
    readonly details: string
}

export class Transaction {

    constructor(builder: {
        extrinsicIndex: number,
        from: string,
        to?: string,
        transferValue?: bigint,
        tip: bigint,
        fees: Fees,
        reserved: bigint,
        pallet: string,
        method: string,
        error?: TransactionError,
        type: TransactionType,
    }) {
        this.extrinsicIndex = builder.extrinsicIndex;
        this.from = builder.from;
        this.to = builder.to || null;
        this.transferValue = builder.transferValue || 0n;
        this.tip = builder.tip || 0n;
        this.fees = builder.fees || NULL_FEES;
        this.reserved = builder.reserved || 0n;
        this.pallet = builder.pallet;
        this.method = builder.method;
        this.error = builder.error;
        this.type = builder.type;
    }
    readonly extrinsicIndex: number;
    readonly from: string;
    readonly to: string | null;
    readonly transferValue: bigint;
    readonly tip: bigint;
    readonly fees: Fees;
    readonly reserved: bigint;
    readonly pallet: string;
    readonly method: string;
    readonly error?: TransactionError;
    readonly type: TransactionType;
}
