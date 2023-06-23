import { Column } from "typeorm";
import { Fees } from "@logion/node-api";

export const AMOUNT_PRECISION = 50;
export const NULL_FEES = new Fees({ inclusionFee: 0n });

export class EmbeddableStorageFees {

    @Column("numeric", { name: "inclusion_fee", precision: AMOUNT_PRECISION, nullable: true })
    inclusionFee?: string;

    @Column("numeric", { name: "storage_fee", precision: AMOUNT_PRECISION, nullable: true })
    storageFee?: string;

    getDescription(): Fees {
        return new Fees({
                inclusionFee: toBigInt(this.inclusionFee) || 0n,
                storageFee: toBigInt(this.storageFee),
            }
        )
    }

    static allFees(fees: Fees): EmbeddableStorageFees {
        const entity = new EmbeddableStorageFees();
        entity.inclusionFee = fees.inclusionFee.toString();
        entity.storageFee = fees.storageFee?.toString();
        return entity;
    }

    static onlyInclusion(fees: { inclusionFee: bigint }): EmbeddableFees {
        const entity = new EmbeddableFees();
        entity.inclusionFee = fees.inclusionFee.toString();
        return entity;
    }
}

export class EmbeddableFees extends EmbeddableStorageFees {

    @Column("numeric", { name: "legal_fee", precision: AMOUNT_PRECISION, nullable: true })
    legalFee?: string;

    @Column("numeric", { name: "certificate_fee", precision: AMOUNT_PRECISION, nullable: true })
    certificateFee?: string;

    getDescription(): Fees {
        return new Fees({
                inclusionFee: toBigInt(this.inclusionFee) || 0n,
                storageFee: toBigInt(this.storageFee),
                legalFee: toBigInt(this.legalFee),
                certificateFee: toBigInt(this.certificateFee),
            }
        )
    }

    static allFees(fees: Fees): EmbeddableFees {
        const entity = new EmbeddableFees();
        entity.inclusionFee = fees.inclusionFee.toString();
        entity.storageFee = fees.storageFee?.toString();
        entity.legalFee = fees.legalFee?.toString();
        entity.certificateFee = fees.certificateFee?.toString();
        return entity;
    }
}

function toBigInt(fee?: string): bigint | undefined {
    return fee ? BigInt(fee) : undefined
}

