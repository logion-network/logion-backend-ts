import { ICompact, INumber } from '@polkadot/types-codec/types/interfaces';
import { Address, Block, Extrinsic, DispatchErrorModule } from '@polkadot/types/interfaces';
import { Adapters, TypesJsonCall } from "@logion/node-api";
import { SignedBlockExtended, TxWithEvent } from '@polkadot/api-derive/type/types';
import { ApiPromise } from '@polkadot/api';
import { BN } from '@polkadot/util';
import {
    ExtrinsicError,
    JsonEvent,
    JsonExtrinsic,
    Fee,
    FeeWithBeneficiary,
    FeeWithBeneficiaryAmount,
} from './types/responses/Extrinsic.js';

export class ExtrinsicsBuilder {

    constructor(api: ApiPromise, block: SignedBlockExtended) {
        this.api = api;
        this.block = block;
    }

    private api: ApiPromise;

    private block: SignedBlockExtended;

    async build(): Promise<JsonExtrinsic[]> {
        const extrinsics = this.block.extrinsics;
        const builders: ExtrinsicBuilder[] = new Array(extrinsics.length);
        for (const record of this.block.events) {
            const { event, phase } = record;

            if (phase.isApplyExtrinsic) {
                const extrinsicIndex = phase.asApplyExtrinsic.toNumber();

                const extrinsicBuilder = builders[extrinsicIndex] ?
                    builders[extrinsicIndex] :
                    this.createBuilder(extrinsics[extrinsicIndex]);

                if(extrinsicBuilder) {
                    builders[extrinsicIndex] = extrinsicBuilder;

                    const jsonEvent: JsonEvent = {
                        section: event.section,
                        method: event.method,
                        data: event.data,
                    };
                    if(event.section === "logionLoc") {
                        if(event.method === "StorageFeeWithdrawn") {
                            extrinsicBuilder.storageFee = this.getFee(jsonEvent);
                        }
                        if(event.method === "LegalFeeWithdrawn") {
                            extrinsicBuilder.legalFee = this.getFeeWithBeneficiary(jsonEvent);
                        }
                        if(event.method === "CertificateFeeWithdrawn") {
                            extrinsicBuilder.certificateFee = this.getFee(jsonEvent);
                        }
                        if(event.method === "ValueFeeWithdrawn") {
                            extrinsicBuilder.valueFee = this.getFee(jsonEvent);
                        }
                        if(event.method === "CollectionItemFeeWithdrawn") {
                            extrinsicBuilder.collectionItemFee = this.getFeeWithBeneficiaryAmount(jsonEvent);
                        }
                        if(event.method === "TokensRecordFeeWithdrawn") {
                            extrinsicBuilder.tokensRecordFee = this.getFeeWithBeneficiaryAmount(jsonEvent);
                        }
                    }
                    extrinsicBuilder.events.push(jsonEvent);
                }
            }
        }
        return builders
            .filter(extrinsic => extrinsic !== undefined)
            .map(builder => builder.build());
    }

    private createBuilder(extrinsicWithEvent: TxWithEvent): ExtrinsicBuilder | undefined {
        const extrinsic = extrinsicWithEvent.extrinsic;
        const call = extrinsic.method;
        const jsonCall = Adapters.toJsonCall(call);

        if(jsonCall.section === "sudo") {
            return undefined;
        }

        let error: () => ExtrinsicError | null;
        if(extrinsicWithEvent.dispatchError && extrinsicWithEvent.dispatchError.isModule) {
            const module = this.toErrorServiceModule(extrinsicWithEvent.dispatchError.asModule);
            error = () => this.findErrorWithApi(this.api, module);
        } else {
            error = () => null;
        }

        let partialFee: () => Promise<bigint>;
        if (!this.isGenesisBlock(this.block.block)) {
            partialFee = () => this.calculatePartialFee(extrinsic);
        } else {
            partialFee = () => Promise.resolve(0n);
        }

        return new ExtrinsicBuilder({
            call: jsonCall,
            extrinsic,
            error,
            partialFee,
        });
    }

    private toErrorServiceModule(dispatchError: DispatchErrorModule): Module {
        return {
            index: dispatchError.index.toBn(),
            // `dispatchError.error` bytes represent a fixed-width integer
            // which, with SCALE codec, is encoded in little-endian format.
            // (see https://docs.substrate.io/reference/scale-codec/).
            error: new BN(dispatchError.error, 'le'),
        };
    }

    private findErrorWithApi(api: ApiPromise, module: Module): Error {
        const metaError = api.registry.findMetaError(module);
        if (metaError) {
            return {
                section: metaError.section,
                name: metaError.name,
                details: metaError.docs.join(', ').trim()
            }
        } else {
            throw new Error(`Unable to locate error metadata (index: ${module.index.toString()}, error: ${module.error.toString()})`);
        }
    }

    private isGenesisBlock(block: Block): boolean {
        const parentHash = block.header.parentHash;
        return parentHash.every((byte) => !byte);
    }

    private async calculatePartialFee(extrinsic: Extrinsic): Promise<bigint> {
        const apiAt = await this.api.at(this.block.block.hash);
        const dispatchInfo = await apiAt.call.transactionPaymentApi.queryInfo(extrinsic, 0);
        const partialFee = dispatchInfo.partialFee;
        return partialFee.toBigInt();
    }

    private getFee(event: JsonEvent): Fee | undefined {
        const withdrawnFrom = event.data[0].toString();
        const fee = event.data[1].toBigInt();
        return {
            withdrawnFrom,
            fee,
        };
    }

    private getFeeWithBeneficiary(event: JsonEvent): FeeWithBeneficiary | undefined {
        const withdrawnFrom = event.data[0].toString();
        const beneficiary: string | undefined = event.data[1].isLegalOfficer ?
            event.data[1].asLegalOfficer.toString() :
            undefined;
        const fee = event.data[2].toBigInt();
        return {
            withdrawnFrom,
            beneficiary,
            fee,
        };
    }

    private getFeeWithBeneficiaryAmount(event: JsonEvent): FeeWithBeneficiaryAmount | undefined {
        const withdrawnFrom = event.data[0].toString();
        const fee = event.data[1].toBigInt();
        const beneficiary: string | undefined = event.data[2].isLegalOfficer ?
            event.data[2].asLegalOfficer.toString() :
            undefined;
        const received = event.data[3].toBigInt();
        return {
            withdrawnFrom,
            beneficiary,
            fee,
            received,
        };
    }
}

export class ExtrinsicBuilder {
    constructor(
        params: {
            call: TypesJsonCall,
            extrinsic: Extrinsic,
            error: () => ExtrinsicError | null,
            partialFee: () => Promise<bigint>,
        }
    ) {
        this.call = params.call;
        this.extrinsic = params.extrinsic;
        this.signer = params.extrinsic.isSigned ? params.extrinsic.signer : null;
        this.tip = params.extrinsic.isSigned ? params.extrinsic.tip : null;
        this.error = params.error;
        this.partialFee = params.partialFee;
        this.events = [];
    }

    public readonly call: TypesJsonCall;
    public readonly signer: Address | null;
    public readonly tip: ICompact<INumber> | null;
    public readonly extrinsic: Extrinsic;
    public readonly partialFee: () => Promise<bigint>;
    public storageFee?: Fee;
    public legalFee?: FeeWithBeneficiary;
    public certificateFee?: Fee;
    public valueFee?: Fee;
    public collectionItemFee?: FeeWithBeneficiaryAmount;
    public tokensRecordFee?: FeeWithBeneficiaryAmount;
    public readonly events: JsonEvent[];
    public readonly error: () => ExtrinsicError | null;

    build(): JsonExtrinsic {
        return {
            call: this.call,
            events: this.events,
            partialFee: () => this.partialFee().then(result => result ? result.toString() : undefined),
            storageFee: this.storageFee,
            legalFee: this.legalFee,
            certificateFee: this.certificateFee,
            valueFee: this.valueFee,
            collectionItemFee: this.collectionItemFee,
            tokensRecordFee: this.tokensRecordFee,
            signer: this.signer ? this.signer.toString() : null,
            tip: this.tip !== null ? this.tip.toString() : null,
            error: this.error,
        };
    }
}

export interface Module {
    readonly index: BN;
    readonly error: BN;
}

export interface Error {
    readonly section: string;
    readonly name: string;
    readonly details: string;
}
