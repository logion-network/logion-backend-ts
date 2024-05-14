import { Fees, Hash, UUID, ValidAccountId } from "@logion/node-api";

import { EmbeddableLifecycle, ItemLifecycle } from "./loc_lifecycle.js";
import { EmbeddableAccountId } from "./supportedaccountid.model.js";

interface FileDescriptionMandatoryFields {
    readonly name: string;
    readonly hash: Hash;
    readonly submitter: ValidAccountId;
    readonly restrictedDelivery: boolean;
    readonly size: number;
}

export interface FileParams extends FileDescriptionMandatoryFields {
    readonly cid?: string;
    readonly contentType?: string;
    readonly nature: string;
}

export interface FileDescription extends FileDescriptionMandatoryFields, ItemLifecycle {
    readonly oid?: number;
    readonly cid?: string;
    readonly contentType?: string;
    readonly nature?: string;
    readonly fees?: Fees;
    readonly storageFeePaidBy?: string;
}

export interface StoredFile {
    readonly name: string;
    readonly size: number;
    readonly cid?: string;
    readonly contentType?: string;
}

export interface Submitted {
    submitter?: EmbeddableAccountId;
    lifecycle?: EmbeddableLifecycle;
}

interface MetadataItemDescriptionMandatoryFields {
    readonly submitter: ValidAccountId;
}

export interface MetadataItemParams extends MetadataItemDescriptionMandatoryFields {
    readonly name: string;
    readonly value: string;
}

export interface MetadataItemDescription extends MetadataItemDescriptionMandatoryFields, ItemLifecycle {
    readonly name?: string;
    readonly nameHash: Hash;
    readonly value?: string;
    readonly fees?: Fees;
}

export interface LinkParams {
    readonly target: string;
    readonly nature: string;
    readonly submitter: ValidAccountId;
}

export interface LinkDescription extends LinkParams, ItemLifecycle {
    readonly fees?: Fees;
}

export interface LocItems {
    metadataNameHashes: Hash[];
    fileHashes: Hash[];
    linkTargets: UUID[];
}

export const EMPTY_ITEMS: LocItems = {
    fileHashes: [],
    linkTargets: [],
    metadataNameHashes: [],
};
