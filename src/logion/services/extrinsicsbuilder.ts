import { ICompact, INumber } from '@polkadot/types-codec/types/interfaces';
import { Address, Block, Extrinsic } from '@polkadot/types/interfaces';
import { asString, JsonCall, toJsonCall } from "./call.js";
import { SignedBlockExtended, TxWithEvent } from '@polkadot/api-derive/type/types';
import { ExtrinsicError, JsonEvent, JsonExtrinsic } from './types/responses/Extrinsic.js';
import { ErrorService, Module } from "./error.service.js";
import { ApiPromise } from '@polkadot/api';

export class ExtrinsicsBuilder {

    constructor(errorService: ErrorService, api: ApiPromise, block: SignedBlockExtended) {
        this.errorService = errorService;
        this.api = api;
        this.block = block;
    }

    private errorService: ErrorService;

    private api: ApiPromise;

    private block: SignedBlockExtended;

    async build(): Promise<JsonExtrinsic[]> {
        const extrinsics = this.block.extrinsics;
        const builders: ExtrinsicBuilder[] = new Array(extrinsics.length);

        for (let i = 0; i < extrinsics.length; i++) {
            const extrinsicBuilder = this.createBuilder(extrinsics[i]);
            if (extrinsicBuilder) {
                builders[i] = extrinsicBuilder;
            }
        }

        for (const record of this.block.events) {
            const { event, phase } = record;

            if (phase.isApplyExtrinsic) {
                const extrinsicIndex = phase.asApplyExtrinsic.toNumber();

                const extrinsicBuilder = builders[extrinsicIndex];
                if(extrinsicBuilder) {
                    builders[extrinsicIndex] = extrinsicBuilder;

                    const jsonEvent: JsonEvent = {
                        section: event.section,
                        method: event.method,
                        data: event.data,
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
        }
        return builders
            .filter(extrinsic => extrinsic !== undefined)
            .map(builder => builder.build());
    }

    private createBuilder(extrinsicWithEvent: TxWithEvent): ExtrinsicBuilder | undefined {
        const extrinsic = extrinsicWithEvent.extrinsic;
        const call = extrinsic.method;
        const jsonCall = toJsonCall(call);

        if(asString(jsonCall.section) === "sudo") {
            return undefined;
        }

        return new ExtrinsicBuilder({
            call: jsonCall,
            extrinsic,
        });
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
}

export class ExtrinsicBuilder {
    constructor(
        params: {
            call: JsonCall,
            extrinsic: Extrinsic,
        }
    ) {
        this.call = params.call;
        this.extrinsic = params.extrinsic;
        this.signer = params.extrinsic.isSigned ? params.extrinsic.signer : null;
        this.tip = params.extrinsic.isSigned ? params.extrinsic.tip : null;
        this.partialFee = () => Promise.resolve(0n);
        this.events = [];
        this.error = () => null;
    }

    public call: JsonCall;
    public signer: Address | null;
    public tip: ICompact<INumber> | null;
    public extrinsic: Extrinsic;
    public partialFee: () => Promise<bigint>;
    public events: JsonEvent[];
    public error: () => ExtrinsicError | null;

    build(): JsonExtrinsic {
        return {
            call: this.call,
            events: this.events,
            partialFee: () => this.partialFee().then(result => result ? result.toString() : undefined),
            signer: this.signer ? this.signer.toString() : null,
            tip: this.tip !== null ? this.tip.toString() : null,
            error: this.error,
        };
    }
}

enum Event {
    success = 'ExtrinsicSuccess',
    failure = 'ExtrinsicFailed',
}
