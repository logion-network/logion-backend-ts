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

}
