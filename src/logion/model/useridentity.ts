import { Column } from "typeorm";

export interface UserIdentity {
    firstName: string,
    lastName: string,
    email: string,
    phoneNumber: string,
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

    static from(identity: UserIdentity | undefined): EmbeddableUserIdentity {
        const embeddable = new EmbeddableUserIdentity();
        if(identity) {
            embeddable.firstName = identity.firstName;
            embeddable.lastName = identity.lastName;
            embeddable.email = identity.email;
            embeddable.phoneNumber = identity.phoneNumber;
        } else {
            embeddable.firstName = "";
            embeddable.lastName = "";
            embeddable.email = "";
            embeddable.phoneNumber = "";
        }
        return embeddable;
    }
}

export function toUserIdentity(embedded: EmbeddableUserIdentity | undefined): UserIdentity | undefined {
    return embedded && (embedded.firstName || embedded.lastName || embedded.email || embedded.phoneNumber)
        ?
        {
            firstName: embedded.firstName || "",
            lastName: embedded.lastName || "",
            email: embedded.email || "",
            phoneNumber: embedded.phoneNumber || "",
        }
        : undefined;
}
