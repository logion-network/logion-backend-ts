import { injectable } from "inversify";
import { Log, requireDefined } from "@logion/rest-api-core";
import { getVaultAddress } from "@logion/node-api";

import { BlockWithTransactions, Transaction, TransactionError } from "./transaction.vo.js";
import { BlockExtrinsics } from "./types/responses/Block.js";
import { JsonExtrinsic } from "./types/responses/Extrinsic.js";
import { JsonArgs, asArray, asString, findEventData } from "./call.js";
import { ExtrinsicDataExtractor } from "./extrinsic.data.extractor.js";

enum ExtrinsicType {
    TIMESTAMP,
    TRANSFER,
    GENERIC_TRANSACTION,
    TRANSFER_FROM_RECOVERED,
    TRANSFER_FROM_VAULT
}

const { logger } = Log;

@injectable()
export class TransactionExtractor {

    constructor(
        private extrinsicDataExtractor: ExtrinsicDataExtractor,
    ) {}

    async extractBlockWithTransactions(block: BlockExtrinsics): Promise<BlockWithTransactions | undefined> {
        if (block.extrinsics === undefined || block.extrinsics.length <= 1) {
            return undefined;
        }
        const blockBuilder = BlockWithTransactions.builder()
            .blockNumber(block.number);
        logger.info("Looking at block %d", block.number);
        const transactions: Transaction[] = [];
        for (let index = 0; index < block.extrinsics.length; index++) {
            const extrinsic = block.extrinsics[index];
            const type = this.determineType(extrinsic);
            if (type === ExtrinsicType.TIMESTAMP) {
                blockBuilder.timestamp(this.extrinsicDataExtractor.getTimestamp(extrinsic))
            } else {
                const blockTransactions = await this.extractTransactions(extrinsic, type, index);
                blockTransactions.forEach(transaction => transactions.push(transaction));
            }
        }
        if (transactions.length === 0) {
            return undefined;
        }
        return blockBuilder.transactions(transactions)
            .build()
    }

    private async extractTransactions(extrinsic: JsonExtrinsic, type: ExtrinsicType, index: number): Promise<Transaction[]> {
        const transactions: Transaction[] = [];
        let from: string = this.from(extrinsic);
        let transferValue: bigint = 0n;
        let to: string | undefined = undefined;

        if(type ===  ExtrinsicType.TRANSFER) {
            transferValue = this.transferValue(extrinsic.call)
            to = this.to(extrinsic.call)
        } else if(type === ExtrinsicType.TRANSFER_FROM_RECOVERED) {
            const account = this.extrinsicDataExtractor.getAccount(extrinsic);
            if (account) {
                from = account
            }
            const call = this.extrinsicDataExtractor.getCall(extrinsic)
            transferValue = this.transferValue(call)
            to = this.to(call)
        } else if(type === ExtrinsicType.TRANSFER_FROM_VAULT && this.error(extrinsic) === undefined) {
            const signer = requireDefined(extrinsic.signer);
            const otherSignatories = asArray(extrinsic.call.args['other_signatories']).map(signatory => asString(signatory));
            const vaultAddress = getVaultAddress(signer, otherSignatories);

            const call = this.extrinsicDataExtractor.getCall(extrinsic);
            const vaultTransferValue = this.transferValue(call);
            const vaultTransferTo = this.to(call);

            transactions.push(new Transaction({
                extrinsicIndex: index,
                pallet: "balances",
                method: "transfer",
                tip: 0n,
                fee: 0n,
                reserved: 0n,
                from: vaultAddress,
                transferValue: vaultTransferValue,
                to: vaultTransferTo,
            }));
        }

        transactions.push(new Transaction({
            extrinsicIndex: index,
            pallet: this.pallet(extrinsic),
            method: this.methodName(extrinsic),
            tip: this.tip(extrinsic),
            fee: await this.fee(extrinsic),
            reserved: this.reserved(extrinsic),
            from,
            transferValue,
            to,
            error: this.error(extrinsic)
        }));

        return transactions;
    }

    private pallet(extrinsic: JsonExtrinsic): string {
        return extrinsic.call.section;
    }

    private methodName(extrinsic: JsonExtrinsic): string {
        return extrinsic.call.method;
    }

    private tip(extrinsic: JsonExtrinsic): bigint {
        return this.undefinedTo0(extrinsic.tip!);
    }

    private async fee(extrinsic: JsonExtrinsic): Promise<bigint> {
        return this.undefinedTo0(await extrinsic.partialFee());
    }

    private reserved(extrinsic: JsonExtrinsic): bigint {
        const data = findEventData(extrinsic, { pallet: "balances", method: "Reserved" });
        if (data === undefined || data.length <= 1) {
            return 0n;
        } else {
            return BigInt(data[1].toString());
        }
    }

    private from(extrinsic: JsonExtrinsic): string {
        return extrinsic.signer || "";
    }

    private to(extrinsicOrCall: { args: JsonArgs }): string | undefined {
        return this.extrinsicDataExtractor.getDest(extrinsicOrCall);
    }

    private transferValue(extrinsicOrCall: { args: JsonArgs }): bigint {
        return this.extrinsicDataExtractor.getValue(extrinsicOrCall);
    }

    private error(extrinsic: JsonExtrinsic): TransactionError | undefined {
        const error = extrinsic.error();
        if (error) {
            return { ...error }
        }
        return undefined;
    }

    private determineType(extrinsic: JsonExtrinsic): ExtrinsicType {
        switch (extrinsic.call.section) {
            case "timestamp":
                return ExtrinsicType.TIMESTAMP

            case "balances":
                return ExtrinsicType.TRANSFER

            case "recovery":
                if (extrinsic.call.method === "asRecovered") {
                    const call = this.extrinsicDataExtractor.getCall(extrinsic)
                    if (call.section === "balances") {
                        return ExtrinsicType.TRANSFER_FROM_RECOVERED
                    }
                }
                return ExtrinsicType.GENERIC_TRANSACTION

            case "vault":
                if(extrinsic.call.method === "approveCall") {
                    const call = this.extrinsicDataExtractor.getCall(extrinsic);
                    if (call.section === "balances") {
                        return ExtrinsicType.TRANSFER_FROM_VAULT
                    }
                }
                return ExtrinsicType.GENERIC_TRANSACTION;

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

