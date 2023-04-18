import { components } from "../controllers/components.js";
import { Column } from "typeorm";

export type SupportedAccountId = components["schemas"]["SupportedAccountId"];
type AddressType = components["schemas"]["AddressType"];

export class EmbeddableSupportedAccountId {

    @Column({ length: 255, name: "_address_type" })
    type?: string;

    @Column({ length: 255, name: "_address" })
    address?: string;

    toSupportedAccountId(): SupportedAccountId {
        return {
            type: (this.type || "Polkadot") as AddressType,
            address: this.address || "",
        }
    }

    static from(supportedAccountId: SupportedAccountId): EmbeddableSupportedAccountId {
        const embeddable = new EmbeddableSupportedAccountId();
        embeddable.type = supportedAccountId.type;
        embeddable.address = supportedAccountId.address;
        return embeddable;
    }
}

type AnyAccountId = {
    type?: string | AddressType;
    address?: string;
}

export function accountEquals(left: AnyAccountId | undefined, right: AnyAccountId | undefined): boolean {
    if (
        left === undefined || right === undefined ||
        left.address === undefined || right.address === undefined ||
        left.type === undefined || right.type === undefined
    ) {
        return false;
    }
    return left.type === right.type &&
        left.address === right.address;
}

export function polkadotAccount(address: string): SupportedAccountId {
    return {
        type: "Polkadot",
        address
    }
}
