import { Column } from "typeorm";

import { AMOUNT_PRECISION } from "./fees.js";
import { toBigInt } from "../lib/convert.js";

export interface LocFees {
    readonly valueFee?: bigint;
    readonly legalFee?: bigint;
    readonly collectionItemFee?: bigint;
    readonly tokensRecordFee?: bigint;
}

export class EmbeddableLocFees {

    @Column("numeric", { name: "value_fee", precision: AMOUNT_PRECISION, nullable: true })
    valueFee?: string | null;

    @Column("numeric", { name: "legal_fee", precision: AMOUNT_PRECISION, nullable: true })
    legalFee?: string | null;

    @Column("numeric", { name: "collection_item_fee", precision: AMOUNT_PRECISION, nullable: true })
    collectionItemFee?: string | null;

    @Column("numeric", { name: "tokens_record_fee", precision: AMOUNT_PRECISION, nullable: true })
    tokensRecordFee?: string | null;

    static from(fees: LocFees | undefined): EmbeddableLocFees | undefined {
        if(fees) {
            const embeddable = new EmbeddableLocFees();
            embeddable.valueFee = fees.valueFee?.toString();
            embeddable.legalFee = fees.legalFee?.toString();
            embeddable.collectionItemFee = fees.collectionItemFee?.toString();
            embeddable.tokensRecordFee = fees.tokensRecordFee?.toString();
            return embeddable;
        } else {
            return undefined;
        }
    }

    to(): LocFees {
        return {
            valueFee: toBigInt(this.valueFee),
            legalFee: toBigInt(this.legalFee),
            collectionItemFee: toBigInt(this.collectionItemFee),
            tokensRecordFee: toBigInt(this.tokensRecordFee),
        }
    }
}
