import { PostalAddress } from "./postaladdress";
import { UserIdentity } from "./useridentity";

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
    legalOfficerAddress: string,
}

