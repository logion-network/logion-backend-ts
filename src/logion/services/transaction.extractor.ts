import { injectable } from "inversify";

import { BlockWithTransactions, Transaction, TransactionError } from "./transaction.vo";
import { BlockExtrinsics } from "./types/responses/Block";
import { JsonExtrinsic } from "./types/responses/Extrinsic";
import { JsonMethod, JsonArgs } from "./call";
import { ExtrinsicDataExtractor } from "./extrinsic.data.extractor";
import { Log } from "../util/Log";

enum ExtrinsicType {
    TIMESTAMP,
    TRANSFER,
    GENERIC_TRANSACTION,
    TRANSFER_FROM_RECOVERED
}

const { logger } = Log;

@injectable()
export class TransactionExtractor {

    constructor(private extrinsicDataExtractor: ExtrinsicDataExtractor) {}

    extractBlockWithTransactions(block: BlockExtrinsics): BlockWithTransactions | undefined {
        if (block.extrinsics === undefined || block.extrinsics.length <= 1) {
            return undefined;
        }
        const blockBuilder = BlockWithTransactions.builder()
            .blockNumber(block.number);
        logger.debug("Looking at block %d", block.number);
        const transactions: Transaction[] = [];
        for (let index = 0; index < block.extrinsics.length; index++) {
            const extrinsic = block.extrinsics[index];
            const type = this.determineType(extrinsic);
            if (type === ExtrinsicType.TIMESTAMP) {
                blockBuilder.timestamp(this.extrinsicDataExtractor.getTimestamp(extrinsic))
            } else {
                const transaction = this.extractTransaction(extrinsic, type, index);
                transactions.push(transaction);
            }
        }
        if (transactions.length === 0) {
            return undefined;
        }
        return blockBuilder.transactions(transactions)
            .build()
    }

    private extractTransaction(extrinsic: JsonExtrinsic, type: ExtrinsicType, index: number): Transaction {
        let from: string = this.from(extrinsic);
        let transferValue: bigint = 0n;
        let to: string | undefined = undefined;

        switch (type) {
            case ExtrinsicType.TRANSFER:
                transferValue = this.transferValue(extrinsic)
                to = this.to(extrinsic)
                break
            case ExtrinsicType.TRANSFER_FROM_RECOVERED:
                const account = this.extrinsicDataExtractor.getAccount(extrinsic);
                if (account) {
                    from = account
                }
                const call = this.extrinsicDataExtractor.getCall(extrinsic)
                transferValue = this.transferValue(call)
                to = this.to(call)
                break
        }

        return new Transaction({
                extrinsicIndex: index,
                pallet: this.pallet(extrinsic),
                method: this.methodName(extrinsic),
                tip: this.tip(extrinsic),
                fee: this.fee(extrinsic),
                reserved: this.reserved(extrinsic),
                from,
                transferValue,
                to,
                error: this.error(extrinsic)
            }
        )
    }

    private pallet(extrinsic: JsonExtrinsic): string {
        return extrinsic.method.pallet;
    }

    private methodName(extrinsic: JsonExtrinsic): string {
        return extrinsic.method.method;
    }

    private tip(extrinsic: JsonExtrinsic): bigint {
        return this.undefinedTo0(extrinsic.tip!);
    }

    private fee(extrinsic: JsonExtrinsic): bigint {
        return this.undefinedTo0(extrinsic.partialFee);
    }

    private reserved(extrinsic: JsonExtrinsic): bigint {
        const data = this.findEventData(extrinsic, { pallet: "balances", method: "Reserved" });
        if (data === undefined || data.length <= 1) {
            return 0n;
        } else {
            return BigInt(data[1]);
        }
    }

    private from(extrinsic: JsonExtrinsic): string {
        return extrinsic.signer || "";
    }

    private to(extrinsicOrCall: { args: JsonArgs }): string | undefined {
        return this.extrinsicDataExtractor.getDest(extrinsicOrCall);
    }

    private transferValue(extrinsicOrCall: { args: JsonArgs }): bigint {
        return BigInt(this.extrinsicDataExtractor.getValue(extrinsicOrCall)).valueOf();
    }

    private error(extrinsic: JsonExtrinsic): TransactionError | undefined {
        if (extrinsic.error) {
            return { ...extrinsic.error }
        }
        return undefined;
    }

    private findEventData(extrinsic: JsonExtrinsic, method: JsonMethod): string[] | undefined {
        const event = extrinsic.events
            .find(event => {
                const eventMethod = event.method;
                return eventMethod.pallet === method.pallet && eventMethod.method === method.method;

            });
        if (event === undefined) {
            return undefined;
        } else {
            return event.data;
        }
    }

    private determineType(extrinsic: JsonExtrinsic): ExtrinsicType {
        const method = extrinsic.method;
        switch (method.pallet) {
            case "timestamp":
                return ExtrinsicType.TIMESTAMP

            case "balances":
                return ExtrinsicType.TRANSFER

            case "recovery":
                if (method.method === "asRecovered") {
                    const call = this.extrinsicDataExtractor.getCall(extrinsic)
                    if (call.method.pallet === "balances") {
                        return ExtrinsicType.TRANSFER_FROM_RECOVERED
                    }
                }
                return ExtrinsicType.GENERIC_TRANSACTION

            default:
                return ExtrinsicType.GENERIC_TRANSACTION
        }
    }

    private undefinedTo0(value?: string): bigint {
        if (value === undefined) {
            return 0n;
        } else {
            return BigInt(value);
        }
    }
}

