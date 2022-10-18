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

    static from(postalAddress: PostalAddress | undefined): EmbeddablePostalAddress {
        const embeddable = new EmbeddablePostalAddress();
        if(postalAddress) {
            embeddable.line1 = postalAddress.line1;
            embeddable.line2 = postalAddress.line2;
            embeddable.postalCode = postalAddress.postalCode;
            embeddable.city = postalAddress.city;
            embeddable.country = postalAddress.country;
        } else {
            embeddable.line1 = "";
            embeddable.line2 = "";
            embeddable.postalCode = "";
            embeddable.city = "";
            embeddable.country = "";
        }
        return embeddable;
    }

}


export function toPostalAddress(embedded: EmbeddablePostalAddress | undefined): PostalAddress | undefined {
    return embedded && (embedded.line1 || embedded.line2 || embedded.postalCode || embedded.city || embedded.country)
        ?
        {
            line1: embedded.line1 || "",
            line2: embedded.line2 || "",
            postalCode: embedded.postalCode || "",
            city: embedded.city || "",
            country: embedded.country || "",
        }
        : undefined;
}
