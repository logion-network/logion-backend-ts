import { Column } from "typeorm";

export interface PostalAddress {
    line1: string,
    line2: string,
    postalCode: string,
    city: string,
    country: string,
}

export class EmbeddablePostalAddress {

    @Column({ length: 255, nullable: true })
    line1?: string;

    @Column({ length: 255, nullable: true })
    line2?: string;

    @Column({ length: 255, name: "postal_code", nullable: true })
    postalCode?: string;

    @Column({ length: 255, nullable: true })
    city?: string;

    @Column({ length: 255, nullable: true })
    country?: string;
}
