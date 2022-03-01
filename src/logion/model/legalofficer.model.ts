import { PostalAddress } from "./protectionrequest.model";
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

