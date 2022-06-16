import { ICompact, INumber } from '@polkadot/types-codec/types/interfaces';
import { Address, Block, Extrinsic } from '@polkadot/types/interfaces';
import { AnyJson, Registry } from '@polkadot/types/types';
import { JsonArgs, JsonMethod, toJsonCall } from "./call";
import { SignedBlockExtended, TxWithEvent } from '@polkadot/api-derive/type/types';
import { ExtrinsicError, JsonExtrinsic } from './types/responses/Extrinsic';
import { ErrorService, Module } from "./error.service";
import { ApiPromise } from '@polkadot/api';

export class ExtrinsicsBuilder {

    constructor(errorService: ErrorService, registry: Registry, api: ApiPromise, block: SignedBlockExtended) {
        this.errorService = errorService;
        this.registry = registry;
        this.api = api;
        this.block = block;
    }

    private errorService: ErrorService;

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
                    extrinsicBuilder.partialFee = () => this.calculatePartialFee(extrinsicBuilder.extrinsic);
                }
            }
        }
        return builders
            .filter(extrinsic => extrinsic !== undefined)
            .map(builder => builder.build());
    }

    private createBuilder(extrinsicWithEvent: TxWithEvent): ExtrinsicBuilder {
        const extrinsic = extrinsicWithEvent.extrinsic;
        const call = this.registry.createType('Call', extrinsic.method);
        const jsonCall = toJsonCall(call, this.registry);

        return new ExtrinsicBuilder({
            method: jsonCall.method,
            args: jsonCall.args,
            extrinsic,
        });
    }

    private isGenesisBlock(block: Block): boolean {
        const parentHash = block.header.parentHash;
        return parentHash.every((byte) => !byte);
    }

    private async calculatePartialFee(extrinsic: Extrinsic): Promise<bigint> {
        const dispatchInfo = await this.api.rpc.payment.queryInfo(extrinsic.toHex(), this.block.block.hash);
        const partialFee = dispatchInfo.partialFee;
        return partialFee.toBigInt();
    }
}

export class ExtrinsicBuilder {
    constructor(
        params: {
            method: JsonMethod;
            args: JsonArgs;
            extrinsic: Extrinsic;
        }
    ) {
        this.method = params.method;
        this.args = params.args;
        this.extrinsic = params.extrinsic;
        this.signer = params.extrinsic.isSigned ? params.extrinsic.signer : null;
        this.paysFee = params.extrinsic.isSigned ? null : false;
        this.tip = params.extrinsic.isSigned ? params.extrinsic.tip : null,
        this.partialFee = () => Promise.resolve(0n);
        this.events = [];
        this.error = () => null;
    }

    public method: JsonMethod;
    public signer: Address | null;
    public args: JsonArgs;
    public tip: ICompact<INumber> | null;
    public extrinsic: Extrinsic;
    public partialFee: () => Promise<bigint>;
    public events: JsonEvent[];
    public paysFee: boolean | null;
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
