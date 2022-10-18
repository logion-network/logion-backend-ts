import { Column } from "typeorm";

export interface UserIdentity {
    firstName: string,
    lastName: string,
    email: string,
    phoneNumber: string,
    company: boolean,
}

export class EmbeddableUserIdentity {

    @Column("varchar", { length: 255, name: "first_name", nullable: true })
    firstName?: string | null;

    @Column("varchar", { length: 255, name: "last_name", nullable: true })
    lastName?: string | null;

    @Column("varchar", { length: 255, nullable: true })
    email?: string | null;

    @Column("varchar", { length: 255, name: "phone_number", nullable: true })
    phoneNumber?: string | null;

    @Column("boolean", { default: false })
    company?: boolean;

    static from(identity: UserIdentity | undefined): EmbeddableUserIdentity {
        const embeddable = new EmbeddableUserIdentity();
        if(identity) {
            embeddable.firstName = identity.firstName;
            embeddable.lastName = identity.lastName;
            embeddable.email = identity.email;
            embeddable.phoneNumber = identity.phoneNumber;
            embeddable.company = identity.company;
        } else {
            embeddable.firstName = "";
            embeddable.lastName = "";
            embeddable.email = "";
            embeddable.phoneNumber = "";
            embeddable.company = false;
        }
        return embeddable;
    }
}

export function toUserIdentity(embedded: EmbeddableUserIdentity | undefined): UserIdentity | undefined {
    return embedded && (embedded.firstName || embedded.lastName || embedded.email || embedded.phoneNumber || embedded.company)
        ?
        {
            firstName: embedded.firstName || "",
            lastName: embedded.lastName || "",
            email: embedded.email || "",
            phoneNumber: embedded.phoneNumber || "",
            company: embedded.company || false,
        }
        : undefined;
}
