import { Moment } from "moment";
import { Column } from "typeorm";

export class EmbeddableVoidInfo {

    @Column("text", { name: "void_reason", nullable: true })
    reason?: string | null;

    @Column("timestamp without time zone", { name: "voided_on", nullable: true })
    voidedOn?: string | null;
}

export interface VoidInfo {
    readonly reason: string;
    readonly voidedOn: Moment | null;
}
