import { UserIdentity } from "./useridentity.js";
import { PostalAddress } from "./postaladdress.js";

export interface PersonalInfo {
    userIdentity: UserIdentity;
    userPostalAddress: PostalAddress;
    company?: string;
}
