import { injectable } from "inversify";
import { Vec, Compact, GenericExtrinsic } from '@polkadot/types';
import { Address, Balance, Block, EventRecord, Hash, } from '@polkadot/types/interfaces';
import { AnyJson, Registry } from '@polkadot/types/types';

import { BlockExtrinsics } from './types/responses/Block';
import { JsonExtrinsic, ExtrinsicError } from './types/responses/Extrinsic';
import { PolkadotService } from "./polkadot.service";
import { JsonArgs, JsonMethod, toJsonCall } from "./call";
import { FeesCalculator, FeesService, WeightInfo } from "./fees.service";
import { ErrorService, Module } from "./error.service";

@injectable()
export class BlockExtrinsicsService {

    constructor(
        private polkadotService: PolkadotService,
        private feesService: FeesService,
        private errorService: ErrorService
    ) {}

    async getHeadBlockNumber(): Promise<bigint> {
        const api = await this.polkadotService.readyApi();
        const hash = await api.rpc.chain.getFinalizedHead();
        const block = await this.getBlockByHash(hash);
        return BigInt(block.header.number.toString());
    }

    private async getBlockByHash(hash: Hash): Promise<Block> {
        const api = await this.polkadotService.readyApi();
        const signedBlock = await api.derive.chain.getBlock(hash);
        if (signedBlock === undefined) {
            throw new Error('Block not found');
        } else {
            return signedBlock.block;
        }
    }

    async getBlockExtrinsics(blockNumber: bigint): Promise<BlockExtrinsics> {
        const api = await this.polkadotService.readyApi();
        const hash = await api.rpc.chain.getBlockHash(blockNumber);
        const { block, events } = await this.blockAndEvents(hash);
        const extrinsics = await this.successfulExtrinsics(block, events);
        return {
            number: BigInt(block.header.number.toString()),
            extrinsics
        };
    }

    private async blockAndEvents(hash: Hash): Promise<{
        block: Block,
        events: Vec<EventRecord>
    }> {
        const api = await this.polkadotService.readyApi();
        const [ signedBlock, events ] = await Promise.all([
            api.derive.chain.getBlock(hash),
            api.query.system.events.at(hash),
        ]);
        if (signedBlock === undefined) {
            throw new Error('Block not found');
        }
        return {
            block: signedBlock.block,
            events
        };
    }

    private async successfulExtrinsics(
        block: Block,
        events: Vec<EventRecord>,
    ): Promise<JsonExtrinsic[]> {
        const builders: ExtrinsicBuilder[] = new Array(block.extrinsics.length);
        let feesCalculator: FeesCalculator | undefined = undefined;
        const extrinsics = block.extrinsics;
        for (const record of events) {
            const { event, phase } = record;

            if (phase.isApplyExtrinsic) {
                const extrinsicIndex = phase.asApplyExtrinsic.toNumber();

                builders[extrinsicIndex] ||= this.createBuilder(extrinsics[extrinsicIndex], events.registry);
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

                if (!this.isGenesisBlock(block)) {
                    if (event.method === Event.failure) {
                        const module: Module = jsonEvent.data[0]['module']
                        extrinsicBuilder.error = await this.errorService.findError(module)
                    }
                    feesCalculator ||= await this.feesService.buildFeesCalculator(block);
                    extrinsicBuilder.partialFee = await this.calculatePartialFee(feesCalculator, extrinsicBuilder, jsonEvent)
                }
            }
        }
        return builders
            .filter(extrinsic => extrinsic !== undefined)
            .map(builder => builder.build());
    }

    private async calculatePartialFee(feesCalculator: FeesCalculator, extrinsicBuilder: ExtrinsicBuilder, jsonEvent: JsonEvent): Promise<bigint> {
        const weightInfo: WeightInfo = jsonEvent.data[jsonEvent.data.length - 1] as WeightInfo;
        if (!weightInfo || !weightInfo.weight) {
            return 0n;
        } else {
            const encodedLength = extrinsicBuilder.encodedLength;
            return (await feesCalculator.getPartialFees(weightInfo, encodedLength)).valueOf();
        }
    }

    private createBuilder(
        extrinsic: GenericExtrinsic,
        registry: Registry,
    ): ExtrinsicBuilder {
        const { method, signer, isSigned, tip } = extrinsic;
        const call = registry.createType('Call', method);
        const jsonCall = toJsonCall(call, registry);

        return new ExtrinsicBuilder({
            method: jsonCall.method,
            args: jsonCall.args,
            encodedLength: extrinsic.encodedLength,
            signer: isSigned ? signer : null,
            tip: isSigned ? tip : null,
            paysFee: isSigned ? null : false,
        });
    }

    private isGenesisBlock(block: Block): boolean {
        const parentHash = block.header.parentHash;
        return parentHash.every((byte) => !byte);
    }
}

enum Event {
    success = 'ExtrinsicSuccess',
    failure = 'ExtrinsicFailed',
}

class ExtrinsicBuilder {
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
        this.partialFee = 0n;
        this.paysFee = params.paysFee;
        this.events = [];
        this.encodedLength = params.encodedLength;
        this.error = null;
    }

    public method: JsonMethod;
    public signer: Address | null;
    public args: JsonArgs;
    public tip: Compact<Balance> | null;
    public partialFee: bigint;
    public events: JsonEvent[];
    public paysFee: boolean | null;
    public encodedLength: number;
    public error: ExtrinsicError | null;

    build(): JsonExtrinsic {
        return {
            method: this.method,
            args: this.args,
            events: this.events.map(event => ({
                method: event.method,
                data: event.data.map(event => event.toString())
            })),
            partialFee: this.partialFee.toString(),
            paysFee: this.paysFee === null ? false : this.paysFee,
            signer: this.signer ? this.signer.toString() : null,
            tip: this.tip !== null ? this.tip.toString() : null,
            error: this.error,
        };
    }
}

interface JsonEvent {
    method: JsonMethod;
    data: any[];
}

interface IPaysFee {
    paysFee: unknown;
}

function isPaysFee(thing: unknown): thing is IPaysFee {
    return !!(thing as IPaysFee)?.paysFee;
}
