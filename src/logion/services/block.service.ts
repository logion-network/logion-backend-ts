import { injectable } from "inversify";
import { Vec, Compact, GenericExtrinsic } from '@polkadot/types';
import {
    Address,
    Balance,
    Block,
    EventRecord,
    Hash,
} from '@polkadot/types/interfaces';
import { AnyJson, Registry } from '@polkadot/types/types';

import { BlockExtrinsics } from './types/responses/Block';
import { JsonExtrinsic } from './types/responses/Extrinsic';
import { PolkadotService } from "./polkadot.service";
import { isJsonMethod, JsonArgs, JsonMethod, toJsonCall } from "./call";
import { FeesService, WeightInfo } from "./fees.service";

@injectable()
export class BlockExtrinsicsService {

    constructor(
        private polkadotService: PolkadotService,
        private feesService: FeesService,
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

        const extrinsicBuilders = this.mergeExtrinsicsAndEvents(block, events);
        if (!this.isGenesisBlock(block)) {
            await this.setFees(block, extrinsicBuilders);
        }

        return {
            number: BigInt(block.header.number.toString()),
            extrinsics: extrinsicBuilders
                .filter(builder => builder.successful)
                .map(builder => builder.build()),
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

    private mergeExtrinsicsAndEvents(
        block: Block,
        events: Vec<EventRecord>
    ): ExtrinsicBuilder[] {
        const builders = this.createBuilders(block.extrinsics, events.registry);
        this.mergeEvents(
            builders,
            events,
        );
        return builders;
    }

    private createBuilders(
        extrinsics: Vec<GenericExtrinsic>,
        registry: Registry,
    ): ExtrinsicBuilder[] {
        return extrinsics.map(extrinsic => {
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
        });
    }

    private mergeEvents(
        extrinsics: ExtrinsicBuilder[],
        events: EventRecord[],
    ): void {
        for (const record of events) {
            const { event, phase } = record;

            if (phase.isApplyExtrinsic) {
                const extrinsicIndex = phase.asApplyExtrinsic.toNumber();
                const extrinsic = extrinsics[extrinsicIndex];
                if (!extrinsic) {
                    throw new Error(`Extrinsic #${extrinsicIndex} not found`);
                }

                if(event.method === Event.success) {
                    extrinsic.successful = true;
    
                    const jsonData = event.data.toJSON() as AnyJson[];
                    for (const item of jsonData) {
                        if (extrinsic.signer !== null && isPaysFee(item)) {
                            extrinsic.paysFee = (item.paysFee === true || item.paysFee === 'Yes');
                            break;
                        }
                    }
    
                    extrinsic.events.push({
                        method: {
                            pallet: event.section,
                            method: event.method,
                        },
                        data: jsonData,
                    });
                } else {
                    extrinsic.successful = false;
                }
            }
        }
    }

    private isGenesisBlock(block: Block): boolean {
        const parentHash = block.header.parentHash;
        return parentHash.every((byte) => !byte);
    }

    private async setFees(
        block: Block,
        extrinsics: ExtrinsicBuilder[]
    ): Promise<void> {
        const feesCalculator = await this.feesService.buildFeesCalculator(block);

        for (const extrinsic of extrinsics) {
            if (!extrinsic.successful || !extrinsic.paysFee || extrinsic.signer === null) {
                continue;
            }

            const successEvent = extrinsic.events.find(({ method }) =>
                    isJsonMethod(method) && (method.method === Event.success));
            if (!successEvent) {
                throw new Error('Unable to find success event for extrinsic');
            }

            const weightInfo: WeightInfo = successEvent.data[successEvent.data.length - 1] as WeightInfo;
            if (!weightInfo.weight) {
                throw new Error('Success event does not specify weight');
            }

            const encodedLength = extrinsic.encodedLength;
            extrinsic.partialFee = (await feesCalculator.getPartialFees(weightInfo, encodedLength)).valueOf();
        }
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
        this.successful = null;
    }

    public method: JsonMethod;
    public signer: Address | null;
    public args: JsonArgs;
    public tip: Compact<Balance> | null;
    public partialFee: bigint;
    public events: ExtrinsicEvent[];
    public paysFee: boolean | null;
    public encodedLength: number;
    public successful: boolean | null;

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
            success: true,
            tip: this.tip !== null ? this.tip.toString() : null
        };
    }
}

interface ExtrinsicEvent {
    method: JsonMethod;
    data: any[];
}

interface IPaysFee {
    paysFee: unknown;
}

function isPaysFee(thing: unknown): thing is IPaysFee {
    return !!(thing as IPaysFee)?.paysFee;
}
