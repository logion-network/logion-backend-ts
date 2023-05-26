import { injectable } from "inversify";
import { Log, requireDefined } from "@logion/rest-api-core";
import { Vault, Adapters, TypesJsonObject, Fees } from "@logion/node-api";

import { BlockWithTransactions, Transaction, TransactionError } from "./transaction.vo.js";
import { BlockExtrinsics } from "./types/responses/Block.js";
import { JsonExtrinsic, findEventData } from "./types/responses/Extrinsic.js";
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
            const otherSignatories = Adapters.asArray(extrinsic.call.args['other_signatories']).map(signatory => Adapters.asString(signatory));
            const vaultAddress = Vault.getVaultAddress(signer, otherSignatories);

            const call = this.extrinsicDataExtractor.getCall(extrinsic);
            const vaultTransferValue = this.transferValue(call);
            const vaultTransferTo = this.to(call);

            transactions.push(new Transaction({
                extrinsicIndex: index,
                pallet: "balances",
                method: "transfer",
                tip: 0n,
                fees: new Fees(0n),
                reserved: 0n,
                from: vaultAddress,
                transferValue: vaultTransferValue,
                to: vaultTransferTo,
            }));
        }

        // Actual extrinsic with only fees applied to the signer
        transactions.push(new Transaction({
            extrinsicIndex: index,
            pallet: this.pallet(extrinsic),
            method: this.methodName(extrinsic),
            tip: this.tip(extrinsic),
            fees: await this.fees(extrinsic),
            reserved: this.reserved(extrinsic),
            from,
            transferValue,
            to,
            error: this.error(extrinsic)
        }));

        if(extrinsic.storageFee || extrinsic.legalFee) {

            if(extrinsic.storageFee && extrinsic.legalFee) {
                if(extrinsic.storageFee.withdrawnFrom === extrinsic.legalFee.withdrawnFrom && extrinsic.storageFee.withdrawnFrom !== extrinsic.signer) {
                    // Both storage and legal fees are withdrawn from an account which is not the signer
                    transactions.push(new Transaction({
                        extrinsicIndex: index,
                        pallet: this.pallet(extrinsic),
                        method: this.methodName(extrinsic),
                        tip: 0n,
                        fees: new Fees(0n, extrinsic.storageFee.fee, extrinsic.legalFee.fee),
                        reserved: 0n,
                        from: extrinsic.storageFee.withdrawnFrom,
                        transferValue: 0n,
                        to: undefined,
                    }));
                } else {
                    // Storage and legal fees are withdrawn from two different accounts which is are not the signer
                    if(extrinsic.storageFee.withdrawnFrom !== extrinsic.signer) {
                        transactions.push(new Transaction({
                            extrinsicIndex: index,
                            pallet: this.pallet(extrinsic),
                            method: this.methodName(extrinsic),
                            tip: 0n,
                            fees: new Fees(0n, extrinsic.storageFee.fee),
                            reserved: 0n,
                            from: extrinsic.storageFee.withdrawnFrom,
                            transferValue: 0n,
                            to: undefined,
                        }));
                    }
                    if(extrinsic.legalFee.withdrawnFrom !== extrinsic.signer) {
                        transactions.push(new Transaction({
                            extrinsicIndex: index,
                            pallet: this.pallet(extrinsic),
                            method: this.methodName(extrinsic),
                            tip: 0n,
                            fees: new Fees(0n, extrinsic.legalFee.fee),
                            reserved: 0n,
                            from: extrinsic.legalFee.withdrawnFrom,
                            transferValue: 0n,
                            to: undefined,
                        }));
                    }
                }
            } else if(extrinsic.storageFee && extrinsic.storageFee.withdrawnFrom !== extrinsic.signer) {
                // Only storage fees are applied and withdrawn from an account which is not the signer
                transactions.push(new Transaction({
                    extrinsicIndex: index,
                    pallet: this.pallet(extrinsic),
                    method: this.methodName(extrinsic),
                    tip: 0n,
                    fees: new Fees(0n, extrinsic.storageFee.fee),
                    reserved: 0n,
                    from: extrinsic.storageFee.withdrawnFrom,
                    transferValue: 0n,
                    to: undefined,
                }));
            } else if(extrinsic.legalFee && extrinsic.legalFee.withdrawnFrom !== extrinsic.signer) {
                // Only legal fees are applied and transferred from an account which is not the signer to a benaficiary
                transactions.push(new Transaction({
                    extrinsicIndex: index,
                    pallet: this.pallet(extrinsic),
                    method: this.methodName(extrinsic),
                    tip: 0n,
                    fees: new Fees(0n),
                    reserved: 0n,
                    from: extrinsic.legalFee.withdrawnFrom,
                    transferValue: extrinsic.legalFee.fee,
                    to: extrinsic.legalFee.beneficiary,
                }));
            }
        }

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

    private async fees(extrinsic: JsonExtrinsic): Promise<Fees> {
        const inclusion = this.undefinedTo0(await extrinsic.partialFee());
        let storage: bigint | undefined = undefined;
        if(extrinsic.storageFee?.withdrawnFrom === extrinsic.signer) {
            storage = extrinsic.storageFee.fee;
        }
        let legal: bigint | undefined = undefined;
        if(extrinsic.legalFee?.withdrawnFrom === extrinsic.signer) {
            legal = extrinsic.legalFee.fee;
        }
        return new Fees(inclusion, storage, legal);
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

    private to(extrinsicOrCall: { args: TypesJsonObject }): string | undefined {
        return this.extrinsicDataExtractor.getDest(extrinsicOrCall);
    }

    private transferValue(extrinsicOrCall: { args: TypesJsonObject }): bigint {
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

