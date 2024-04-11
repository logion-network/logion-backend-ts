import { Column } from "typeorm";
import { ValidAccountId, AnyAccountId, AccountType, AccountId } from "@logion/node-api";

export class EmbeddableNullableAccountId {

    @Column({ length: 255, name: "_address_type", nullable: true })
    type?: string;

    @Column({ length: 255, name: "_address", nullable: true })
    address?: string;

    toValidAccountId(): ValidAccountId | undefined {
        if (this.type && this.address) {
            const accountId = new AnyAccountId(
                this.address,
                this.type as AccountType
            );
            return accountId.toValidAccountId();
        } else {
            return undefined;
        }
    }

    static from(validAccountId: ValidAccountId): EmbeddableNullableAccountId {
        const embeddable = new EmbeddableNullableAccountId();
        embeddable.type = validAccountId.type;
        embeddable.address = validAccountId.getAddress(DB_SS58_PREFIX);
        return embeddable;
    }
}

export class EmbeddableAccountId {

    @Column({ length: 255, name: "_address_type" })
    type?: string;

    @Column({ length: 255, name: "_address" })
    address?: string;

    toValidAccountId(): ValidAccountId {
        const accountId = new AnyAccountId(
            this.address || "",
            (this.type || "Polkadot") as AccountType
        );
        return accountId.toValidAccountId();
    }

    static from(validAccountId: ValidAccountId): EmbeddableAccountId {
        const embeddable = new EmbeddableAccountId();
        embeddable.type = validAccountId.type;
        embeddable.address = validAccountId.getAddress(DB_SS58_PREFIX);
        return embeddable;
    }
}

export function validAccountId(account: AccountId | undefined): ValidAccountId | undefined {
    if (account === undefined) {
        return undefined;
    }
    return new AnyAccountId(account.address, account.type).toValidAccountId();
}

/*
 * Prior to Solo-to-para migration, the SS58 prefix was implicit,
 * i.e. one user was correctly identified if and only if he/she
 * used always the same prefix, 42.
 *
 * As of the migration to parachain, user must be able to be identified
 * with an address encoded with any prefix, and find
 * his/her data back, stored with the prefix 42.
 */
export const DB_SS58_PREFIX = 42;
