import { injectable } from "inversify";
import { Block, Hash } from '@polkadot/types/interfaces';
import { SignedBlockExtended } from '@polkadot/api-derive/type/types';

import { BlockExtrinsics } from './types/responses/Block';
import { PolkadotService } from "./polkadot.service";
import { FeesService } from "./fees.service";
import { ErrorService } from "./error.service";
import { ExtrinsicsBuilder } from "./extrinsicsbuilder";

@injectable()
export class BlockExtrinsicsService {

    constructor(
        private polkadotService: PolkadotService,
        private feesService: FeesService,
        private errorService: ErrorService
    ) {}

    async getHeadBlockNumber(): Promise<bigint> {
        const hash = await this.getHeadBlockHash();
        const block = await this.getBlockByHash(hash);
        return this.getBlockNumber(block.block);
    }

    getBlockNumber(block: Block): bigint {
        return BigInt(block.header.number.toString());
    }

    async getHeadBlockHash(): Promise<Hash> {
        const api = await this.polkadotService.readyApi();
        return await api.rpc.chain.getFinalizedHead();
    }

    async getBlocksUpTo(hash: Hash, maxBlocks: bigint): Promise<SignedBlockExtended[]> {
        const arrayLength = Number(maxBlocks);
        const blocks = new Array<SignedBlockExtended>(arrayLength);
        let nextHash = hash;
        let index = arrayLength - 1;
        while(index >= 0) {
            let nextBlock = await this.getBlockByHash(nextHash);
            blocks[index] = nextBlock;
            nextHash = nextBlock.block.header.parentHash;
            --index;
        }
        return blocks;
    }

    async getBlockHash(blockNumber: bigint): Promise<Hash> {
        const api = await this.polkadotService.readyApi();
        return await api.rpc.chain.getBlockHash(blockNumber);
    }

    async getBlockByHash(hash: Hash): Promise<SignedBlockExtended> {
        const api = await this.polkadotService.readyApi();
        const signedBlock = await api.derive.chain.getBlock(hash);
        if (signedBlock === undefined) {
            throw new Error('Block not found');
        } else {
            return signedBlock;
        }
    }

    async getBlockExtrinsics(block: SignedBlockExtended): Promise<BlockExtrinsics> {
        const hash = block.block.header.hash;
        const api = await this.polkadotService.readyApi();
        const apiAt = await api.at(hash);
        const registry = apiAt.registry;
        const builder = new ExtrinsicsBuilder(this.feesService, this.errorService, registry, api, block);
        const extrinsics = await builder.build();
        return {
            number: BigInt(block.block.header.number.toString()),
            extrinsics
        };
    }
}
