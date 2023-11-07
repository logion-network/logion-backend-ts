import { injectable } from "inversify";
import { Log, requireDefined } from "@logion/rest-api-core";
import { Vault, Adapters, TypesJsonObject, Fees } from "@logion/node-api";

import { BlockWithTransactions, Transaction, TransactionError } from "./transaction.vo.js";
import { BlockExtrinsics } from "./types/responses/Block.js";
import { JsonExtrinsic, findEventsData, Fee } from "./types/responses/Extrinsic.js";
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
        const signer = requireDefined(extrinsic.signer);
        let from: string = signer;
        let transferValue: bigint = 0n;
        let to: string | undefined = undefined;

        if(type ===  ExtrinsicType.TRANSFER) {
            transferValue = this.transferValue(extrinsic)
            to = this.to(extrinsic.call)
        } else if(type === ExtrinsicType.TRANSFER_FROM_RECOVERED) {
            const account = this.extrinsicDataExtractor.getAccount(extrinsic);
            if (account) {
                from = account
            }
            const call = this.extrinsicDataExtractor.getCall(extrinsic)
            transferValue = this.transferValue(extrinsic)
            to = this.to(call)
        } else if(type === ExtrinsicType.TRANSFER_FROM_VAULT && this.error(extrinsic) === undefined) {
            const otherSignatories = Adapters.asArray(extrinsic.call.args['other_signatories']).map(signatory => Adapters.asString(signatory));
            const vaultAddress = Vault.getVaultAddress(signer, otherSignatories);

            const call = this.extrinsicDataExtractor.getCall(extrinsic);
            const vaultTransferValue = this.transferValue(extrinsic);
            const vaultTransferTo = this.to(call);

            transactions.push(new Transaction({
                extrinsicIndex: index,
                pallet: "balances",
                method: "transfer",
                tip: 0n,
                fees: new Fees({ inclusionFee: 0n }),
                reserved: 0n,
                from: vaultAddress,
                transferValue: vaultTransferValue,
                to: vaultTransferTo,
                type: "VAULT_OUT",
            }));
        }

        const reservedMap = this.reservedMap(extrinsic);

        // Actual extrinsic with only fees applied to the signer
        transactions.push(new Transaction({
            extrinsicIndex: index,
            pallet: this.pallet(extrinsic),
            method: this.methodName(extrinsic),
            tip: this.tip(extrinsic),
            fees: await this.fees(extrinsic),
            reserved: reservedMap[signer] || 0n,
            from,
            transferValue,
            to,
            error: this.error(extrinsic),
            type: "EXTRINSIC",
        }));
        delete reservedMap[signer];

        if(extrinsic.storageFee && extrinsic.storageFee.withdrawnFrom !== signer) {
            transactions.push(new Transaction({
                extrinsicIndex: index,
                pallet: this.pallet(extrinsic),
                method: this.methodName(extrinsic),
                tip: 0n,
                fees: new Fees({ inclusionFee: 0n, storageFee: extrinsic.storageFee.fee }),
                reserved: 0n,
                from: extrinsic.storageFee.withdrawnFrom,
                transferValue: 0n,
                to: undefined,
                type: "STORAGE_FEE",
            }));
        }

        if(extrinsic.certificateFee && extrinsic.certificateFee.withdrawnFrom !== signer) {
            transactions.push(new Transaction({
                extrinsicIndex: index,
                pallet: this.pallet(extrinsic),
                method: this.methodName(extrinsic),
                tip: 0n,
                fees: new Fees({ inclusionFee: 0n, certificateFee: extrinsic.certificateFee.fee }),
                reserved: 0n,
                from: extrinsic.certificateFee.withdrawnFrom,
                transferValue: 0n,
                to: undefined,
                type: "CERTIFICATE_FEE",
            }));
        }

        if(extrinsic.legalFee && extrinsic.legalFee.withdrawnFrom !== signer) {
            transactions.push(new Transaction({
                extrinsicIndex: index,
                pallet: this.pallet(extrinsic),
                method: this.methodName(extrinsic),
                tip: 0n,
                fees: new Fees({ inclusionFee: 0n }),
                reserved: 0n,
                from: extrinsic.legalFee.withdrawnFrom,
                transferValue: extrinsic.legalFee.fee,
                to: extrinsic.legalFee.beneficiary,
                type: "LEGAL_FEE",
            }));
        }

        if(extrinsic.valueFee && extrinsic.valueFee.withdrawnFrom !== signer) {
            transactions.push(new Transaction({
                extrinsicIndex: index,
                pallet: this.pallet(extrinsic),
                method: this.methodName(extrinsic),
                tip: 0n,
                fees: new Fees({ inclusionFee: 0n }),
                reserved: reservedMap[extrinsic.valueFee.withdrawnFrom] || 0n,
                from: extrinsic.valueFee.withdrawnFrom,
                transferValue: extrinsic.valueFee.fee,
                to: undefined,
                type: "VALUE_FEE",
            }));

            delete reservedMap[extrinsic.valueFee.withdrawnFrom];
        }

        for(const account of Object.keys(reservedMap)) {
            transactions.push(new Transaction({
                extrinsicIndex: index,
                pallet: this.pallet(extrinsic),
                method: this.methodName(extrinsic),
                tip: 0n,
                fees: new Fees({ inclusionFee: 0n }),
                reserved: reservedMap[account],
                from: account,
                transferValue: undefined,
                to: undefined,
                type: "RESERVE",
            }));
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
        const feesPaidBySigner = (abstractFee: Fee | undefined) => {
            if (abstractFee?.withdrawnFrom === extrinsic.signer) {
                return abstractFee.fee
            }
        }
        return new Fees({
            inclusionFee: this.undefinedTo0(await extrinsic.partialFee()),
            storageFee: feesPaidBySigner(extrinsic.storageFee),
            legalFee: feesPaidBySigner(extrinsic.legalFee),
            certificateFee: feesPaidBySigner(extrinsic.certificateFee),
            valueFee: feesPaidBySigner(extrinsic.valueFee),
            collectionItemFee: feesPaidBySigner(extrinsic.collectionItemFee),
            tokensRecordFee: feesPaidBySigner(extrinsic.tokensRecordFee),
        });
    }

    private reservedMap(extrinsic: JsonExtrinsic): Record<string, bigint> {
        const map: Record<string, bigint> = {};
        const reservedData = findEventsData(extrinsic, { pallet: "balances", method: "Reserved" });
        for (const data of reservedData) {
            const reserved = map[data[0].toString()] || 0n;
            map[data[0].toString()] = reserved + BigInt(data[1].toString());
        }
        const unreservedData = findEventsData(extrinsic, { pallet: "balances", method: "Unreserved" });
        for (const data of unreservedData) {
            const reserved = map[data[0].toString()] || 0n;
            map[data[0].toString()] = reserved - BigInt(data[1].toString());
        }
        return map;
    }

    private to(extrinsicOrCall: { args: TypesJsonObject }): string | undefined {
        return this.extrinsicDataExtractor.getDest(extrinsicOrCall);
    }

    private transferValue(extrinsic: JsonExtrinsic): bigint {
        const params = findEventsData(extrinsic, { pallet: "balances", method: "Transfer" })[0];
        if (params && params.length > 2) {
            return BigInt(params[2].toString());
        } else {
            return 0n;
        }
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
