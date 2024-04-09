import { PostalAddress } from "./postaladdress.js";
import { UserIdentity } from "./useridentity.js";
import { ValidAccountId } from "@logion/node-api";

interface LegalOfficerPostalAddress extends PostalAddress {
    readonly company: string
}

export interface LegalOfficer {
    readonly address: string;
    readonly userIdentity: UserIdentity
    readonly postalAddress: LegalOfficerPostalAddress
    readonly additionalDetails: string
    readonly node: string
}

export interface LegalOfficerSettingId {
    id: string,
    legalOfficer: ValidAccountId,
}

