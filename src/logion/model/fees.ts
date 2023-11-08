import { Column } from "typeorm";
import { Fees } from "@logion/node-api";
import { toBigInt } from "../lib/convert.js";

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
        });
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

    @Column("numeric", { name: "value_fee", precision: AMOUNT_PRECISION, nullable: true })
    valueFee?: string;

    @Column("numeric", { name: "collection_item_fee", precision: AMOUNT_PRECISION, nullable: true })
    collectionItemFee?: string;

    @Column("numeric", { name: "tokens_record_fee", precision: AMOUNT_PRECISION, nullable: true })
    tokensRecordFee?: string;

    getDescription(): Fees {
        return new Fees({
            inclusionFee: toBigInt(this.inclusionFee) || 0n,
            storageFee: toBigInt(this.storageFee),
            legalFee: toBigInt(this.legalFee),
            certificateFee: toBigInt(this.certificateFee),
            valueFee: toBigInt(this.valueFee),
            collectionItemFee: toBigInt(this.collectionItemFee),
            tokensRecordFee: toBigInt(this.tokensRecordFee),
        });
    }

    static allFees(fees: Fees): EmbeddableFees {
        const entity = new EmbeddableFees();
        entity.inclusionFee = fees.inclusionFee.toString();
        entity.storageFee = fees.storageFee?.toString();
        entity.legalFee = fees.legalFee?.toString();
        entity.certificateFee = fees.certificateFee?.toString();
        entity.valueFee = fees.valueFee?.toString();
        entity.collectionItemFee = fees.collectionItemFee?.toString();
        entity.tokensRecordFee = fees.tokensRecordFee?.toString();
        return entity;
    }
}
