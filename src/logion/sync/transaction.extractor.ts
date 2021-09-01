import { injectable } from "inversify";

import { BlockWithTransactions, Transaction } from "./transaction.vo";
import { BlockExtrinsics } from "../services/types/responses/Block";
import { JsonExtrinsic } from "../services/types/responses/Extrinsic";
import { JsonMethod } from "../services/call";
import { ExtrinsicDataExtractor } from "../services/extrinsic.data.extractor";
import { Log } from "../util/Log";

enum ExtrinsicType {
    TIMESTAMP,
    TRANSFER,
    GENERIC_TRANSACTION
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
        return new Transaction({
                extrinsicIndex: index,
                pallet: this.pallet(extrinsic),
                method: this.methodName(extrinsic),
                tip: this.tip(extrinsic),
                fee: this.fee(extrinsic),
                reserved: this.reserved(extrinsic),
                from: this.from(extrinsic),
                transferValue: type === ExtrinsicType.TRANSFER ? this.transferValue(extrinsic) : 0n,
                to: type === ExtrinsicType.TRANSFER ? this.to(extrinsic) : undefined,
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

    private to(extrinsic: JsonExtrinsic): string | undefined {
        return this.extrinsicDataExtractor.getDest(extrinsic);
    }

    private transferValue(extrinsic: JsonExtrinsic): bigint {
        return BigInt(this.extrinsicDataExtractor.getValue(extrinsic)).valueOf();
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

