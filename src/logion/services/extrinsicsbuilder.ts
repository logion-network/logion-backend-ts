import { Compact } from '@polkadot/types';
import { Address, Balance, Block } from '@polkadot/types/interfaces';
import { AnyJson, Registry } from '@polkadot/types/types';
import { JsonArgs, JsonMethod, toJsonCall } from "./call";
import { FeesCalculator, FeesService, WeightInfo } from "./fees.service";
import { SignedBlockExtended, TxWithEvent } from '@polkadot/api-derive/type/types';
import { ExtrinsicError, JsonExtrinsic } from './types/responses/Extrinsic';
import { ErrorService, Module } from "./error.service";
import { ApiPromise } from '@polkadot/api';

export class ExtrinsicsBuilder {

    constructor(feesService: FeesService, errorService: ErrorService, registry: Registry, api: ApiPromise, block: SignedBlockExtended) {
        this.feesService = feesService;
        this.errorService = errorService;
        this.registry = registry;
        this.api = api;
        this.block = block;
    }

    private feesService: FeesService;

    private errorService: ErrorService;

    private feesCalculator: FeesCalculator | undefined = undefined;

    private registry: Registry;

    private api: ApiPromise;

    private block: SignedBlockExtended;

    async build(): Promise<JsonExtrinsic[]> {
        const extrinsics = this.block.extrinsics;
        const builders: ExtrinsicBuilder[] = new Array(extrinsics.length);
        for (const record of this.block.events) {
            const { event, phase } = record;

            if (phase.isApplyExtrinsic) {
                const extrinsicIndex = phase.asApplyExtrinsic.toNumber();

                builders[extrinsicIndex] ||= this.createBuilder(extrinsics[extrinsicIndex]);
                const extrinsicBuilder: ExtrinsicBuilder = builders[extrinsicIndex];

                const jsonData = event.data.toJSON() as AnyJson[];
                for (const item of jsonData) {
                    if (extrinsicBuilder.signer !== null && isPaysFee(item)) {
                        extrinsicBuilder.paysFee = (item.paysFee === true || item.paysFee === 'Yes');
                        break;
                    }
                }

                const jsonEvent: JsonEvent = {
                    method: {
                        pallet: event.section,
                        method: event.method,
                    },
                    data: jsonData,
                };
                extrinsicBuilder.events.push(jsonEvent);

                if (!this.isGenesisBlock(this.block.block)) {
                    if (event.method === Event.failure) {
                        const module: Module = jsonEvent.data[0]['module'];
                        extrinsicBuilder.error = () => this.errorService.findErrorWithApi(this.api, module);
                    }
                    extrinsicBuilder.partialFee = () => this.calculatePartialFee(extrinsicBuilder.encodedLength, jsonEvent);
                }
            }
        }
        return builders
            .filter(extrinsic => extrinsic !== undefined)
            .map(builder => builder.build());
    }

    private createBuilder(extrinsic: TxWithEvent): ExtrinsicBuilder {
        const { method, signer, isSigned, tip, encodedLength } = extrinsic.extrinsic;
        const call = this.registry.createType('Call', method);
        const jsonCall = toJsonCall(call, this.registry);

        return new ExtrinsicBuilder({
            method: jsonCall.method,
            args: jsonCall.args,
            encodedLength,
            signer: isSigned ? signer : null,
            tip: isSigned ? tip : null,
            paysFee: isSigned ? null : false,
        });
    }

    private isGenesisBlock(block: Block): boolean {
        const parentHash = block.header.parentHash;
        return parentHash.every((byte) => !byte);
    }

    private async calculatePartialFee(extrinsicEncodedLength: number, jsonEvent: JsonEvent): Promise<bigint> {
        const weightInfo: WeightInfo = jsonEvent.data[jsonEvent.data.length - 1] as WeightInfo;
        const feesCalculator = await this.feesCalculatorBuilder();
        if (!weightInfo || !weightInfo.weight || !feesCalculator) {
            return 0n;
        } else {
            return feesCalculator!.getPartialFees(weightInfo, extrinsicEncodedLength).valueOf();
        }
    }

    private async feesCalculatorBuilder(): Promise<FeesCalculator | undefined> {
        if(!this.feesCalculator) {
            this.feesCalculator = await this.feesService.buildFeesCalculator(this.block.block);
        }
        return this.feesCalculator;
    }
}

export class ExtrinsicBuilder {
    constructor(
        params: {
            method: JsonMethod;
            signer: Address | null;
            args: JsonArgs;
            tip: Compact<Balance> | null;
            paysFee: boolean | null;
            encodedLength: number;
        }
    ) {
        this.method = params.method;
        this.signer = params.signer;
        this.args = params.args;
        this.tip = params.tip;
        this.partialFee = () => Promise.resolve(0n);
        this.paysFee = params.paysFee;
        this.events = [];
        this.encodedLength = params.encodedLength;
        this.error = () => null;
    }

    public method: JsonMethod;
    public signer: Address | null;
    public args: JsonArgs;
    public tip: Compact<Balance> | null;
    public partialFee: () => Promise<bigint>;
    public events: JsonEvent[];
    public paysFee: boolean | null;
    public encodedLength: number;
    public error: () => ExtrinsicError | null;

    build(): JsonExtrinsic {
        return {
            method: this.method,
            args: this.args,
            events: this.events.map(event => ({
                method: event.method,
                data: event.data.map(event => event.toString())
            })),
            partialFee: () => this.partialFee().then(result => result ? result.toString() : undefined),
            paysFee: this.paysFee === null ? false : this.paysFee,
            signer: this.signer ? this.signer.toString() : null,
            tip: this.tip !== null ? this.tip.toString() : null,
            error: this.error,
        };
    }
}

export interface JsonEvent {
    method: JsonMethod;
    data: any[];
}
enum Event {
    success = 'ExtrinsicSuccess',
    failure = 'ExtrinsicFailed',
}

interface IPaysFee {
    paysFee: unknown;
}

function isPaysFee(thing: unknown): thing is IPaysFee {
    return !!(thing as IPaysFee)?.paysFee;
}
