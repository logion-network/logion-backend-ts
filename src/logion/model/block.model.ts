import { ChainType } from "@logion/node-api";
import { Column } from "typeorm";

export class Block {

    static soloBlock(blockNumber: bigint): Block {
        return new Block({
            blockNumber,
            chainType: "Solo",
        });
    }

    static paraBlock(blockNumber: bigint): Block {
        return new Block({
            blockNumber,
            chainType: "Para",
        });
    }

    constructor(args: {
        blockNumber: bigint;
        chainType: ChainType;
    }) {
        this.blockNumber = args.blockNumber;
        this.chainType = args.chainType;
    }

    readonly blockNumber: bigint;
    readonly chainType: ChainType;

    equalTo(other: Block | undefined): boolean {
        return this.blockNumber === other?.blockNumber && this.chainType === other.chainType;
    }

    genesis(): Block {
        return this.at(0n);
    }

    at(blockNumber: bigint): Block {
        return new Block({
            blockNumber,
            chainType: this.chainType,
        });
    }
}

function toChainType(value: string | undefined): ChainType {
    if(value === "Solo" || value === "Para") {
        return value;
    } else {
        throw new Error(`Unexpected value ${ value }`);
    }
}

export class EmbeddableBlock {

    static from(block: Block): EmbeddableBlock {
        const embeddable = new EmbeddableBlock();
        embeddable.blockNumber = block.blockNumber.toString();
        embeddable.chainType = block.chainType;
        return embeddable;
    }

    @Column("bigint", {name: "block_number"})
    blockNumber?: string;

    @Column("varchar", {name: "chain_type", length: 4})
    chainType?: string;

    toBlock(): Block {
        return new Block({
            blockNumber: BigInt(this.blockNumber!),
            chainType: toChainType(this.chainType),
        });
    }
}
