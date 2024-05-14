import { UUID, ValidAccountId } from "@logion/node-api";

import { components } from "../controllers/components.js";
import { UserIdentity } from "./useridentity.js";
import { PostalAddress } from "./postaladdress.js";
import { PublicSeal } from "../services/seal.service.js";
import { LocFees } from "./loc_fees.js";

export type LocType = components["schemas"]["LocType"];

export interface CollectionParams {
    lastBlockSubmission: bigint | undefined;
    maxSize: number | undefined;
    canUpload: boolean;
}

export interface LocRequestDescription {
    readonly requesterAddress?: ValidAccountId;
    readonly requesterIdentityLoc?: string;
    readonly ownerAddress: ValidAccountId;
    readonly description: string;
    readonly createdOn: string;
    readonly userIdentity: UserIdentity | undefined;
    readonly userPostalAddress: PostalAddress | undefined;
    readonly locType: LocType;
    readonly seal?: PublicSeal;
    readonly company?: string;
    readonly template?: string;
    readonly sponsorshipId?: UUID;
    readonly fees: LocFees;
    readonly collectionParams?: CollectionParams;
}

export interface LocRequestDecision {
    readonly decisionOn: string;
    readonly rejectReason?: string;
}

export interface RecoverableSecret {
    readonly name: string;
    readonly value: string;
}
