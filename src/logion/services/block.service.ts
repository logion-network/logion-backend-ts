import { injectable } from "inversify";
import { Block, Hash, SignedBlock } from '@polkadot/types/interfaces';
import { SignedBlockExtended } from '@polkadot/api-derive/type/types';
import { PolkadotService } from "@logion/rest-api-core";

import { BlockExtrinsics } from './types/responses/Block.js';
import { ExtrinsicsBuilder } from "./extrinsicsbuilder.js";
import { ChainType } from "@logion/node-api";

export interface SignedBlockAndChainType {
    signedBlock: SignedBlock;
    chainType: ChainType;
}

@injectable()
export class BlockExtrinsicsService {

    constructor(
        private polkadotService: PolkadotService,
    ) {}

    async getHeadBlockNumber(): Promise<bigint> {
        const hash = await this.getHeadBlockHash();
        const block = await this.getBlockByHash(hash);
        return this.getBlockNumber(block.signedBlock.block);
    }

    getBlockNumber(block: Block): bigint {
        return BigInt(block.header.number.toString());
    }

    async getHeadBlockHash(): Promise<Hash> {
        const api = await this.polkadotService.readyApi();
        return await api.polkadot.rpc.chain.getFinalizedHead();
    }

    async getBlocksUpTo(hash: Hash, maxBlocks: bigint): Promise<SignedBlockAndChainType[]> {
        const arrayLength = Number(maxBlocks);
        const blocks = new Array<SignedBlockAndChainType>(arrayLength);
        let nextHash = hash;
        let index = arrayLength - 1;
        while(index >= 0) {
            const nextBlock = await this.getBlockByHash(nextHash);
            blocks[index] = nextBlock;
            nextHash = nextBlock.signedBlock.block.header.parentHash;
            --index;
        }
        return blocks;
    }

    async getBlockHash(blockNumber: bigint): Promise<Hash> {
        const api = await this.polkadotService.readyApi();
        return await api.polkadot.rpc.chain.getBlockHash(blockNumber);
    }

    async getBlockByHash(hash: Hash): Promise<SignedBlockAndChainType> {
        const api = await this.polkadotService.readyApi();
        const block = await api.polkadot.rpc.chain.getBlock(hash);
        if (block === undefined) {
            throw new Error('Block not found');
        } else {
            return {
                signedBlock: block,
                chainType: api.chainType,
            };
        }
    }

    async getExtendedBlockByHash(hash: Hash): Promise<SignedBlockExtended> {
        const api = await this.polkadotService.readyApi();
        const block = await api.polkadot.derive.chain.getBlock(hash);
        if (block === undefined) {
            throw new Error('Block not found');
        } else {
            return block;
        }
    }

    async getBlockExtrinsics(block: SignedBlockExtended): Promise<BlockExtrinsics> {
        const api = await this.polkadotService.readyApi();
        const builder = new ExtrinsicsBuilder(api.polkadot, block);
        const extrinsics = await builder.build();
        return {
            number: BigInt(block.block.header.number.toString()),
            chain: api.chainType,
            extrinsics
        };
    }
}
