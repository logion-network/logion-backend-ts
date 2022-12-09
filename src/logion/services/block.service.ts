import { injectable } from "inversify";
import { Block, Hash, SignedBlock } from '@polkadot/types/interfaces';
import { SignedBlockExtended } from '@polkadot/api-derive/type/types';
import { PolkadotService } from "@logion/rest-api-core";

import { BlockExtrinsics } from './types/responses/Block.js';
import { ErrorService } from "./error.service.js";
import { ExtrinsicsBuilder } from "./extrinsicsbuilder.js";

@injectable()
export class BlockExtrinsicsService {

    constructor(
        private polkadotService: PolkadotService,
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

    async getBlocksUpTo(hash: Hash, maxBlocks: bigint): Promise<SignedBlock[]> {
        const arrayLength = Number(maxBlocks);
        const blocks = new Array<SignedBlock>(arrayLength);
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

    async getBlockByHash(hash: Hash): Promise<SignedBlock> {
        const api = await this.polkadotService.readyApi();
        const block = await api.rpc.chain.getBlock(hash);
        if (block === undefined) {
            throw new Error('Block not found');
        } else {
            return block;
        }
    }

    async getExtendedBlockByHash(hash: Hash): Promise<SignedBlockExtended> {
        const api = await this.polkadotService.readyApi();
        const block = await api.derive.chain.getBlock(hash);
        if (block === undefined) {
            throw new Error('Block not found');
        } else {
            return block;
        }
    }

    async getBlockExtrinsics(block: SignedBlockExtended): Promise<BlockExtrinsics> {
        const api = await this.polkadotService.readyApi();
        const builder = new ExtrinsicsBuilder(this.errorService, api, block);
        const extrinsics = await builder.build();
        return {
            number: BigInt(block.block.header.number.toString()),
            extrinsics
        };
    }
}
