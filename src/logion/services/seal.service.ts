import { injectable } from "inversify";
import { sha256String } from "../lib/crypto/hashing";
import { v4 as uuid } from "uuid";
import { UserIdentity } from "../model/useridentity";

const SEPARATOR: string = "-";

export interface Seal {
    hash: string
    salt: string
}

abstract class SealService<T> {

    private readonly separator: string

    protected constructor(separator: string) {
        this.separator = separator;
    }

    public seal(obj: T, salt: string = uuid()): Seal {
        return this._seal(this.values(obj), salt);
    }

    protected _seal(values: string[], salt: string): Seal {
        const hash = sha256String(this.serialize(values, salt))
        return {
            hash,
            salt,
        }
    }

    public verify(obj: T, seal: Seal): boolean {
        return this._verify(this.values(obj), seal)
    }

    protected _verify(sealable: string[], seal: Seal): boolean {
        const { hash } = this._seal(sealable, seal.salt)
        return hash === seal.hash;
    }

    private serialize(values: string [], salt: string): string {
        return values.concat([ salt ]).join(this.separator)
    }

    abstract values(obj: T): string[];
}

@injectable()
export class UserIdentitySealService extends SealService<UserIdentity> {

    constructor() {
        super(SEPARATOR);
    }

    values(userIdentity: UserIdentity): string[] {
        return [ userIdentity.firstName, userIdentity.lastName, userIdentity.email ];
    }
}


