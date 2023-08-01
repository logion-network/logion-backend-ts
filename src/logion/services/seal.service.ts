import { injectable } from "inversify";
import { Hash } from "@logion/node-api";
import { v4 as uuid } from "uuid";
import { UserIdentity } from "../model/useridentity.js";
import { PostalAddress } from "../model/postaladdress.js";
import { PersonalInfo } from "../model/personalinfo.model.js";

const SEPARATOR: string = "-";

export interface PublicSeal {
    hash: Hash;
    version: number;
}

export interface Seal extends PublicSeal {
    salt: string;
}

abstract class SealService<T> {

    private readonly separator: string

    protected constructor(separator: string) {
        this.separator = separator;
    }

    public seal(obj: T, version: number, salt: string = uuid()): Seal {
        return this._seal(this.values(obj, version), salt, version);
    }

    protected _seal(values: string[], salt: string, version: number): Seal {
        const hash = Hash.of(this.serialize(values, salt));
        return {
            hash,
            salt,
            version,
        }
    }

    public verify(obj: T, seal: Seal): boolean {
        return this._verify(this.values(obj, seal.version), seal)
    }

    protected _verify(sealable: string[], seal: Seal): boolean {
        const { hash } = this._seal(sealable, seal.salt, seal.version)
        return hash.equalTo(seal.hash);
    }

    private serialize(values: string [], salt: string): string {
        return values.concat([ salt ]).join(this.separator)
    }

    abstract values(obj: T, version: number): string[];
}

export const LATEST_SEAL_VERSION = 1;

@injectable()
export class PersonalInfoSealService extends SealService<PersonalInfo> {

    constructor() {
        super(SEPARATOR);
    }

    override values(personalInfo: PersonalInfo, version: number): string[] {
        let values = [];
        values = this.userIdentityValues(personalInfo.userIdentity, version);
        if(version === LATEST_SEAL_VERSION && personalInfo.company) {
            values.push(personalInfo.company)
        }
        values = values.concat(this.postalAddressValue(personalInfo.userPostalAddress, version));
        return values;
    }

    private userIdentityValues(userIdentity: UserIdentity, version: number): string[] {
        if(version === 0 || version === LATEST_SEAL_VERSION) {
            return [ userIdentity.firstName, userIdentity.lastName, userIdentity.email, userIdentity.phoneNumber ];
        } else {
            throw new Error(`Unsupported seal version ${version}`);
        }
    }

    private postalAddressValue(postalAddress: PostalAddress, version: number): string[] {
        if(version === 0 || version === LATEST_SEAL_VERSION) {
            return [ postalAddress.line1, postalAddress.line2, postalAddress.postalCode, postalAddress.city, postalAddress.country ];
        } else {
            throw new Error(`Unsupported seal version ${version}`);
        }
    }
}
