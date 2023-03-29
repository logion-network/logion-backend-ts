import { Column } from "typeorm";

export const AMOUNT_PRECISION = 50;

export class EmbeddableFees {

    @Column("numeric", { name: "inclusion_fee", precision: AMOUNT_PRECISION, nullable: true })
    inclusionFee?: string;

    @Column("numeric", { name: "storage_fee", precision: AMOUNT_PRECISION, nullable: true })
    storageFee?: string;
}
