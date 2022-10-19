import { UserIdentity } from "./useridentity";
import { PostalAddress } from "./postaladdress";

export interface PersonalInfo {
    userIdentity: UserIdentity;
    userPostalAddress: PostalAddress;
    company?: string;
}
