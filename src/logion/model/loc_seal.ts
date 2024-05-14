import { Column } from "typeorm";

import { PublicSeal, Seal } from "../services/seal.service";
import { Hash } from "@logion/node-api";

export class EmbeddableSeal {
    @Column({ name: "seal_salt", type: "uuid", nullable: true })
    salt?: string | null;

    @Column({ name: "seal_hash", type: "varchar", length: 255, nullable: true })
    hash?: string | null;

    @Column({ name: "seal_version", type: "integer", default: 0 })
    version?: number | null;

    static from(seal: Seal | undefined): EmbeddableSeal | undefined {
        if (!seal) {
            return undefined;
        }
        const result = new EmbeddableSeal();
        result.hash = seal.hash.toHex();
        result.salt = seal.salt;
        result.version = seal.version;
        return result;
    }
}

export function toPublicSeal(embedded: EmbeddableSeal | undefined): PublicSeal | undefined {
    return embedded && embedded.hash && embedded.version !== undefined && embedded.version !== null
        ?
        {
            hash: Hash.fromHex(embedded.hash),
            version: embedded.version
        }
        : undefined;
}
