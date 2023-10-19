import { injectable } from "inversify";
import moment, { Moment } from "moment";
import { Entity, PrimaryColumn, Column, Repository, ManyToOne, JoinColumn, OneToMany, Unique, Index } from "typeorm";
import { WhereExpressionBuilder } from "typeorm/query-builder/WhereExpressionBuilder.js";
import { EntityManager } from "typeorm/entity-manager/EntityManager.js";
import { Fees, UUID } from "@logion/node-api";
import { appDataSource, Log, requireDefined, badRequest } from "@logion/rest-api-core";

import { components } from "../controllers/components.js";
import { EmbeddableUserIdentity, toUserIdentity, UserIdentity } from "./useridentity.js";
import { orderAndMap, HasIndex } from "../lib/db/collections.js";
import { deleteIndexedChild, Child, saveIndexedChildren, saveChildren } from "./child.js";
import { EmbeddablePostalAddress, PostalAddress } from "./postaladdress.js";
import { LATEST_SEAL_VERSION, PersonalInfoSealService, PublicSeal, Seal } from "../services/seal.service.js";
import { PersonalInfo } from "./personalinfo.model.js";
import {
    IdenfyCallbackPayload,
    IdenfyVerificationSession,
    IdenfyVerificationStatus
} from "../services/idenfy/idenfy.types.js";
import { AMOUNT_PRECISION, EmbeddableStorageFees } from "./fees.js";
import {
    SupportedAccountId,
    EmbeddableSupportedAccountId,
    accountEquals,
    polkadotAccount
} from "./supportedaccountid.model.js";
import { SelectQueryBuilder } from "typeorm/query-builder/SelectQueryBuilder.js";
import { Hash, HashTransformer } from "../lib/crypto/hashing.js";

const { logger } = Log;

export type LocRequestStatus = components["schemas"]["LocRequestStatus"];
export type LocType = components["schemas"]["LocType"];
export type IdentityLocType = components["schemas"]["IdentityLocType"];
export type ItemStatus = components["schemas"]["ItemStatus"];

export interface LocRequestDescription {
    readonly requesterAddress?: SupportedAccountId;
    readonly requesterIdentityLoc?: string;
    readonly ownerAddress: string;
    readonly description: string;
    readonly createdOn: string;
    readonly userIdentity: UserIdentity | undefined;
    readonly userPostalAddress: PostalAddress | undefined;
    readonly locType: LocType;
    readonly seal?: PublicSeal;
    readonly company?: string;
    readonly template?: string;
    readonly sponsorshipId?: UUID;
    readonly valueFee?: bigint;
    readonly legalFee?: bigint;
}

export interface LocRequestDecision {
    readonly decisionOn: string;
    readonly rejectReason?: string;
}

interface FileDescriptionMandatoryFields {
    readonly name: string;
    readonly hash: Hash;
    readonly submitter: SupportedAccountId;
    readonly restrictedDelivery: boolean;
    readonly size: number;
}

export interface FileParams extends FileDescriptionMandatoryFields {
    readonly cid?: string;
    readonly contentType?: string;
    readonly nature: string;
}

export interface StoredFile {
    readonly name: string;
    readonly size: number;
    readonly cid?: string;
    readonly contentType?: string;
}

export interface FileDescription extends FileDescriptionMandatoryFields, ItemLifecycle {
    readonly oid?: number;
    readonly cid?: string;
    readonly contentType?: string;
    readonly nature?: string;
    readonly fees?: Fees;
    readonly storageFeePaidBy?: string;
}

interface MetadataItemDescriptionMandatoryFields {
    readonly submitter: SupportedAccountId;
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

export interface ItemLifecycle {
    readonly status: ItemStatus;
    readonly rejectReason?: string;
    readonly reviewedOn?: Moment;
    readonly addedOn?: Moment;
    readonly acknowledgedByOwnerOn?: Moment;
    readonly acknowledgedByVerifiedIssuerOn?: Moment;
}

export interface LinkParams {
    readonly target: string;
    readonly nature: string;
    readonly submitter: SupportedAccountId;
}

export interface LinkDescription extends LinkParams, ItemLifecycle {
    readonly fees?: Fees;
}

export interface VoidInfo {
    readonly reason: string;
    readonly voidedOn: Moment | null;
}

export type SubmissionType = "MANUAL_BY_USER" | "MANUAL_BY_OWNER" | "DIRECT_BY_REQUESTER"; // "USER" can be Requester or VI.

export class EmbeddableLifecycle {

    @Column("varchar", { length: 255 })
    status?: ItemStatus

    @Column("varchar", { length: 255, name: "reject_reason", nullable: true })
    rejectReason?: string | null;

    @Column("timestamp without time zone", { name: "reviewed_on", nullable: true })
    reviewedOn?: Date;

    @Column("timestamp without time zone", { name: "added_on", nullable: true })
    addedOn?: Date;

    @Column("timestamp without time zone", { name: "acknowledged_by_owner_on", nullable: true })
    acknowledgedByOwnerOn?: Date;

    @Column("boolean", { name: "acknowledged_by_owner", default: false })
    acknowledgedByOwner?: boolean;

    @Column("timestamp without time zone", { name: "acknowledged_by_verified_issuer_on", nullable: true })
    acknowledgedByVerifiedIssuerOn?: Date;

    @Column("boolean", { name: "acknowledged_by_verified_issuer", default: false })
    acknowledgedByVerifiedIssuer?: boolean;

    requestReview() {
        if (this.status !== "DRAFT") {
            throw badRequest(`Cannot request a review on item with status ${ this.status }`);
        }
        this.status = "REVIEW_PENDING";
    }

    accept() {
        if (this.status !== "REVIEW_PENDING") {
            throw badRequest(`Cannot accept an item with status ${ this.status }`);
        }
        this.status = "REVIEW_ACCEPTED";
        this.reviewedOn = moment().toDate();
    }

    reject(reason: string) {
        if (this.status !== "REVIEW_PENDING") {
            throw badRequest(`Cannot reject an item with status ${ this.status }`);
        }
        this.status = "REVIEW_REJECTED";
        this.rejectReason = reason;
        this.reviewedOn = moment().toDate();
    }

    prePublishOrAcknowledge(isAcknowledged: boolean) {
        const acknowledgedOrPublished = isAcknowledged ? "ACKNOWLEDGED" : "PUBLISHED";
        if (this.status !== "REVIEW_ACCEPTED" && this.status !== acknowledgedOrPublished) {
            throw badRequest(`Cannot pre-publish/-acknowledge item with status ${ this.status }`);
        }
        this.status = acknowledgedOrPublished;
    }

    preAcknowledge(expectVerifiedIssuer: boolean, byVerifiedIssuer: boolean, acknowledgedOn?: Moment) {
        if (this.status !== "PUBLISHED" && this.status !== "ACKNOWLEDGED") {
            throw badRequest(`Cannot confirm-acknowledge item with status ${ this.status }`);
        }
        if(byVerifiedIssuer) {
            this.acknowledgedByVerifiedIssuer = true;
            this.acknowledgedByVerifiedIssuerOn = acknowledgedOn ? acknowledgedOn.toDate() : undefined;
        } else {
            this.acknowledgedByOwner = true;
            this.acknowledgedByOwnerOn = acknowledgedOn ? acknowledgedOn.toDate() : undefined;
        }
        if(
            (this.acknowledgedByOwner && this.acknowledgedByVerifiedIssuer)
            || (!expectVerifiedIssuer && this.acknowledgedByOwner)
        ) {
            this.status = "ACKNOWLEDGED";
        }
    }

    isAcknowledged(): boolean {
        return this.status === "ACKNOWLEDGED";
    }

    isPublished(): boolean {
        return this.status === "PUBLISHED";
    }

    setAddedOn(addedOn: Moment) {
        if (this.addedOn) {
            logger.warn("Item added on date is already set");
        }
        this.addedOn = addedOn.toDate();
        if(this.status === "REVIEW_ACCEPTED") {
            this.status = "PUBLISHED";
        }
    }

    getDescription(): ItemLifecycle {
        return {
            status: this.status!,
            rejectReason: this.status === "REVIEW_REJECTED" ? this.rejectReason! : undefined,
            reviewedOn: this.reviewedOn ? moment(this.reviewedOn) : undefined,
            addedOn: this.addedOn ? moment(this.addedOn) : undefined,
            acknowledgedByOwnerOn: this.acknowledgedByOwnerOn ? moment(this.acknowledgedByOwnerOn) : undefined,
            acknowledgedByVerifiedIssuerOn: this.acknowledgedByVerifiedIssuerOn ? moment(this.acknowledgedByVerifiedIssuerOn) : undefined,
        }
    }

    static fromSubmissionType(submissionType: SubmissionType) {
        const lifecycle = new EmbeddableLifecycle();
        lifecycle.status =
            submissionType === "DIRECT_BY_REQUESTER" ? "PUBLISHED" :
                submissionType === "MANUAL_BY_OWNER" ? "REVIEW_ACCEPTED" : "DRAFT";
        lifecycle.acknowledgedByOwner = submissionType === "MANUAL_BY_OWNER";
        lifecycle.acknowledgedByOwnerOn = submissionType === "MANUAL_BY_OWNER" ? moment().toDate() : undefined;
        lifecycle.acknowledgedByVerifiedIssuer = false;
        return lifecycle;
    }

    static default(status: ItemStatus  | undefined) {
        const lifecycle = new EmbeddableLifecycle();
        lifecycle.status = status;
        lifecycle.acknowledgedByOwner = false;
        lifecycle.acknowledgedByVerifiedIssuer = false;
        return lifecycle;
    }
}

class EmbeddableVoidInfo {

    @Column("text", { name: "void_reason", nullable: true })
    reason?: string | null;

    @Column("timestamp without time zone", { name: "voided_on", nullable: true })
    voidedOn?: string | null;
}

class EmbeddableSeal {
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

function toPublicSeal(embedded: EmbeddableSeal | undefined): PublicSeal | undefined {
    return embedded && embedded.hash && embedded.version !== undefined && embedded.version !== null
        ?
        {
            hash: Hash.fromHex(embedded.hash),
            version: embedded.version
        }
        : undefined;
}

type EmbeddableIdenfyVerificationStatus = 'PENDING' | IdenfyVerificationStatus;

class EmbeddableIdenfyVerification {

    @Column("varchar", { name: "idenfy_auth_token", length: 40, nullable: true })
    authToken?: string | null;

    @Column("varchar", { name: "idenfy_scan_ref", length: 40, nullable: true })
    scanRef?: string | null;

    @Column("varchar", { name: "idenfy_status", length: 255, nullable: true })
    status?: EmbeddableIdenfyVerificationStatus | null;

    @Column("text", { name: "idenfy_callback_payload", nullable: true })
    callbackPayload?: string | null;
}

@Entity("loc_request")
export class LocRequestAggregateRoot {

    submit(): void {
        if (this.status != 'DRAFT') {
            throw new Error("Cannot submit a non-draft request");
        }
        if(this.iDenfyVerification && this.iDenfyVerification.status === "PENDING") {
            throw new Error("Cannot submit with ongoing iDenfy verification session");
        }
        this.status = 'REVIEW_PENDING';
        this.updateAllDraftItemsStatus("REVIEW_PENDING");
    }

    reject(reason: string, rejectedOn: Moment): void {
        if (this.status != 'REVIEW_PENDING') {
            throw new Error(`Cannot reject request with status ${ this.status }`);
        }

        this.status = 'REVIEW_REJECTED';
        this.rejectReason = reason;
        this.decisionOn = rejectedOn.toISOString();
    }

    rework(): void {
        if (this.status != 'REVIEW_REJECTED' && this.status != 'REVIEW_ACCEPTED') {
            throw new Error("Cannot rework a non-reviewed request");
        }
        this.status = 'DRAFT';
        this.decisionOn = null;
        this.rejectReason = null;
    }

    accept(decisionOn: Moment): void {
        if (this.status != 'REVIEW_PENDING') {
            throw new Error("Cannot accept already decided request");
        }
        this.status = 'REVIEW_ACCEPTED';
        this.decisionOn = decisionOn.toISOString();
    }

    open(createdOn?: Moment): void {
        if (this.status != 'REVIEW_ACCEPTED' && this.status != 'OPEN') {
            throw new Error(`Cannot open request with status ${ this.status }`);
        }
        this.status = 'OPEN';
        if (createdOn) {
            this.createdOn = createdOn.toISOString();
        }
    }

    getDescription(): LocRequestDescription {
        const userIdentity = toUserIdentity(this.userIdentity);
        const userPostalAddress = this.userPostalAddress &&
        (this.userPostalAddress.line1 || this.userPostalAddress.line2 || this.userPostalAddress.postalCode || this.userPostalAddress.city || this.userPostalAddress.country) ?
            {
                line1: this.userPostalAddress.line1 || "",
                line2: this.userPostalAddress.line2 || "",
                postalCode: this.userPostalAddress.postalCode || "",
                city: this.userPostalAddress.city || "",
                country: this.userPostalAddress.country || "",
            } : undefined;
        return {
            requesterAddress: this.getRequester(),
            requesterIdentityLoc: this.requesterIdentityLocId,
            ownerAddress: this.ownerAddress!,
            description: this.description!,
            createdOn: this.createdOn!,
            userIdentity,
            userPostalAddress,
            locType: this.locType!,
            seal: toPublicSeal(this.seal),
            company: this.company!,
            template: this.template,
            sponsorshipId: this.sponsorshipId ? new UUID(this.sponsorshipId) : undefined,
            valueFee: this.valueFee ? BigInt(this.valueFee) : undefined,
            legalFee: this.legalFee ? BigInt(this.legalFee) : undefined,
        };
    }

    getRequester(): SupportedAccountId | undefined {
        return (this.requesterAddressType === "Polkadot" || this.requesterAddressType === "Ethereum") ? {
            address: this.requesterAddress!,
            type: this.requesterAddressType!,
        } : undefined
    }

    getDecision(): LocRequestDecision | undefined {
        if (this.status !== 'DRAFT' && this.status !== 'REVIEW_PENDING') {
            return {
                decisionOn: this.decisionOn!,
                rejectReason: this.status === 'REVIEW_REJECTED' ? this.rejectReason! : undefined
            }
        }
    }

    addFile(fileDescription: FileParams, submissionType: SubmissionType) {
        this.ensureEditable(submissionType);
        if (this.hasFile(fileDescription.hash)) {
            throw new Error("A file with given hash was already added to this LOC");
        }
        const file = new LocFile();
        file.request = this;
        file.requestId = this.id;
        file.index = this.files!.length;
        file.name = fileDescription.name;
        file.hash! = fileDescription.hash.toHex();
        file.cid = fileDescription.cid;
        file.contentType = fileDescription.contentType;
        file.lifecycle = EmbeddableLifecycle.fromSubmissionType(submissionType);
        file.nature = fileDescription.nature;
        file.submitter = EmbeddableSupportedAccountId.from(fileDescription.submitter);
        file.size = fileDescription.size.toString();
        file.restrictedDelivery = fileDescription.restrictedDelivery;
        file.delivered = [];
        file._toAdd = true;
        this.files!.push(file);
    }

    updateFileContent(hash: Hash, storedFile: StoredFile) {
        this.mutateFile(hash, item => {
            item.name = storedFile.name;
            item.size = storedFile.size.toString();
            item.contentType = storedFile.contentType;
            item.cid = storedFile.cid;
        });
    }

    private ensureEditable(submissionType?: SubmissionType) {
        if (!(this.status === "DRAFT" || this.status === "OPEN")) {
            throw new Error("LOC is not editable");
        }
        if (submissionType === "DIRECT_BY_REQUESTER" && this.status !== "OPEN") {
            throw new Error("Item directly submitted by requester is only possible on OPEN LOC.")
        }
    }

    requestFileReview(hash: Hash) {
        this.mutateFile(hash, item => item.lifecycle!.requestReview());
    }

    acceptFile(hash: Hash) {
        this.ensureCanAcceptOrReject();
        this.mutateFile(hash, item => item.lifecycle!.accept());
    }

    private ensureCanAcceptOrReject() {
        if(this.status !== "REVIEW_PENDING" && this.status !== "REVIEW_ACCEPTED" && this.status !== "OPEN") {
            throw new Error("Request must be pending, accepted or open");
        }
    }

    rejectFile(hash: Hash, reason: string) {
        this.ensureCanAcceptOrReject();
        this.mutateFile(hash, item => item.lifecycle!.reject(reason));
    }

    prePublishOrAcknowledgeFile(hash: Hash, contributor: SupportedAccountId) {
        if(!this.canPrePublishOrAcknowledgeFile(hash, contributor)) {
            throw new Error("Contributor cannot confirm");
        }
        this.mutateFile(hash, item => item.lifecycle!.prePublishOrAcknowledge(item.submitter?.type !== "Polkadot" || this.isOwner(item.submitter.toSupportedAccountId())));
    }

    isOwner(account?: SupportedAccountId) {
        return accountEquals(account, this.getOwner());
    }

    canPreAcknowledgeFile(hash: Hash, contributor: SupportedAccountId): boolean {
        const file = this.getFileOrThrow(hash);
        return this.canPreAcknowledge(file, contributor);
    }

    private canPreAcknowledge(submitted: Submitted, contributor: SupportedAccountId): boolean {
        const owner = this.getOwner();
        if (accountEquals(contributor, owner)) {
            return true;
        }
        const submitter = submitted.submitter?.toSupportedAccountId();
        return this.isVerifiedIssuer(submitter) && accountEquals(contributor, submitter);
    }

    preAcknowledgeFile(hash: Hash, contributor: SupportedAccountId, acknowledgedOn?: Moment) {
        this.mutateFile(hash, file => file.lifecycle!.preAcknowledge(
            this.isVerifiedIssuer(file.submitter?.toSupportedAccountId()),
            this.isVerifiedIssuer(contributor),
            acknowledgedOn
        ))
    }

    canPrePublishOrAcknowledgeFile(hash: Hash, contributor: SupportedAccountId): boolean {
        this.ensureOpen();
        const file = this.getFileOrThrow(hash);
        return this.canPrePublishOrAcknowledge(file, contributor);
    }

    private ensureOpen() {
        if(this.status !== "OPEN") {
            throw new Error("Must be open");
        }
    }

    private canPrePublishOrAcknowledge(submitted: Submitted, contributor: SupportedAccountId): boolean {
        const submitter = submitted.submitter?.toSupportedAccountId();
        const owner = this.getOwner();
        if (submitter?.type !== "Polkadot" && accountEquals(owner, contributor)) {
            return true;
        }
        const requester = this.getRequester();
        if(this.isVerifiedIssuer(submitter) ||  this.isRequester(submitter)) {
            return accountEquals(contributor, requester);
        } else {
            return accountEquals(contributor, owner);
        }
    }

    isRequester(account?: SupportedAccountId) {
        return accountEquals(account, this.getRequester());
    }

    isVerifiedIssuer(account?: SupportedAccountId) {
        return !this.isOwner(account)
            && !this.isRequester(account)
    }

    private mutateFile(hash: Hash, mutator: (item: LocFile) => void) {
        const file = this.getFileOrThrow(hash);
        mutator(file);
        file._toUpdate = true;
    }

    private updateAllDraftItemsStatus(statusTo: ItemStatus) {
        this.mutateAllItems(item => item.status = statusTo, this.metadata, item => item.status === "DRAFT");
        this.mutateAllItems(item => item.status = statusTo, this.files, item => item.status === "DRAFT");
        this.mutateAllItems(item => item.status = statusTo, this.links, item => item.status === "DRAFT");
    }

    private mutateAllItems<T extends Child>(mutator: (item: T) => void, items?: T[], filter?: (item: T) => boolean) {
        if(filter !== undefined) {
            items?.filter(filter).forEach(item => { mutator(item); item._toUpdate = true });
        } else {
            items?.forEach(item => { mutator(item); item._toUpdate = true });
        }
    }

    getFileOrThrow(hash: Hash) {
        const file = this.file(hash);
        if(!file) {
            throw new Error(`No file with hash ${hash.toHex()}`);
        }
        return file;
    }

    private file(hash: Hash): LocFile | undefined {
        return this.files?.find(file => file.hash === hash.toHex());
    }

    hasFile(hash: Hash): boolean {
        return this.file(hash) !== undefined;
    }

    getFile(hash: Hash): FileDescription {
        return this.toFileDescription(this.getFileOrThrow(hash));
    }

    private toFileDescription(file: LocFile): FileDescription {
        return {
            name: file!.name!,
            contentType: file!.contentType!,
            hash: Hash.fromHex(file!.hash!),
            oid: file!.oid,
            cid: file!.cid,
            nature: file!.nature!,
            submitter: file!.submitter!.toSupportedAccountId(),
            restrictedDelivery: file!.restrictedDelivery || false,
            size: parseInt(file.size!),
            fees: file.fees && file.fees.getDescription(),
            storageFeePaidBy: file.storageFeePaidBy,
            ...(file.lifecycle!.getDescription()),
        };
    }

    private itemViewable(item: { status?: ItemStatus, submitter?: { type?: string, address?: string } }, viewerAddress?: SupportedAccountId): boolean {
        return item.status === 'ACKNOWLEDGED' ||
            accountEquals(viewerAddress, this.getOwner()) ||
            accountEquals(viewerAddress, item.submitter) ||
            (accountEquals(viewerAddress, this.getRequester()) && this.notAcknowledgedItemViewableByRequester(item));
    }

    private notAcknowledgedItemViewableByRequester(item: { status?: ItemStatus, submitter?: { type?: string, address?: string } }) {
        return accountEquals(item.submitter, this.getOwner())
            || (item.status === "REVIEW_ACCEPTED" || item.status === "PUBLISHED"); // submitted by verified issuer
    }

    getFiles(viewerAddress?: SupportedAccountId): FileDescription[] {
        return orderAndMap(this.files?.filter(item => this.itemViewable(item, viewerAddress)), file => this.toFileDescription(file));
    }

    setLocCreatedDate(timestamp: Moment) {
        if (this.locCreatedOn) {
            logger.warn("LOC created date is already set");
        }
        this.locCreatedOn = timestamp.toISOString();
        if (this.status === "REVIEW_ACCEPTED" || this.status === "OPEN") {
            this.open(timestamp);
        }
    }

    getLocCreatedDate(): Moment {
        return moment(this.locCreatedOn!);
    }

    preClose(autoAck: boolean) {
        if(autoAck) {
            this.ensureAllItemsAckedOrPublished();
            this.ensureAllItemsAckedByVerifiedIssuer();
            this.ackAllItemsByOwner();
        } else {
            this.ensureAllItemsAcked();
        }
        if(this.status === "OPEN") {
            this.status = 'CLOSED';
        }
    }

    private ensureAllItemsAckedOrPublished() {
        if(this.itemExists(item => !item.lifecycle?.isAcknowledged() && !item.lifecycle?.isPublished(), this.metadata)) {
            throw new Error("A metadata item was not yet published nor acknowledged");
        }
        if(this.itemExists(item => !item.lifecycle?.isAcknowledged() && !item.lifecycle?.isPublished(), this.files)) {
            throw new Error("A file was not yet published nor acknowledged");
        }
        if(this.itemExists(item => !item.lifecycle?.isAcknowledged() && !item.lifecycle?.isPublished(), this.links)) {
            throw new Error("A link was not yet published nor acknowledged");
        }
    }

    private itemExists<T>(predicate: (item: T) => boolean, items?: T[]) {
        return items?.find(predicate) !== undefined;
    }

    private ensureAllItemsAckedByVerifiedIssuer() {
        if(this.itemExists(item => this.isSubmittedByVerifiedIssuerButNotAcknowledged(item.submitter, item.lifecycle), this.metadata)) {
            throw new Error("A verified issuer's metadata item was not yet acknowledged");
        }
        if(this.itemExists(item => this.isSubmittedByVerifiedIssuerButNotAcknowledged(item.submitter, item.lifecycle), this.files)) {
            throw new Error("A verified issuer's file was not yet acknowledged");
        }
        if(this.itemExists(item => this.isSubmittedByVerifiedIssuerButNotAcknowledged(item.submitter, item.lifecycle), this.links)) {
            throw new Error("A verified issuer's link was not yet acknowledged");
        }
    }

    private isSubmittedByVerifiedIssuerButNotAcknowledged(submitter?: EmbeddableSupportedAccountId, lifecycle?: EmbeddableLifecycle) {
        return this.isVerifiedIssuer(submitter?.toSupportedAccountId()) && !lifecycle?.acknowledgedByVerifiedIssuer;
    }

    private ackAllItemsByOwner() {
        this.mutateAllItems(item => item.lifecycle?.preAcknowledge(this.isVerifiedIssuer(item.submitter?.toSupportedAccountId()), false), this.metadata);
        this.mutateAllItems(item => item.lifecycle?.preAcknowledge(this.isVerifiedIssuer(item.submitter?.toSupportedAccountId()), false), this.files);
        this.mutateAllItems(item => item.lifecycle?.preAcknowledge(this.isVerifiedIssuer(item.submitter?.toSupportedAccountId()), false), this.links);
    }

    private ensureAllItemsAcked() {
        if(this.itemExists(item => !item.lifecycle?.isAcknowledged(), this.metadata)) {
            throw new Error("A metadata item was not yet acknowledged");
        }
        if(this.itemExists(item => !item.lifecycle?.isAcknowledged(), this.files)) {
            throw new Error("A file was not yet acknowledged");
        }
        if(this.itemExists(item => !item.lifecycle?.isAcknowledged(), this.links)) {
            throw new Error("A link was not yet acknowledged");
        }
    }

    close(timestamp: Moment) {
        if (this.closedOn) {
            logger.warn("LOC is already closed");
        }
        this.closedOn = timestamp.toISOString();
        this.status = 'CLOSED';
    }

    getClosedOn(): Moment | null {
        return (this.closedOn !== undefined && this.closedOn !== null) ? moment(this.closedOn) : null;
    }

    addMetadataItem(itemDescription: MetadataItemParams, submissionType: SubmissionType) {
        this.ensureEditable(submissionType);
        const nameHash = Hash.of(itemDescription.name);
        if (this.hasMetadataItem(nameHash)) {
            throw new Error("A metadata item with given nameHash was already added to this LOC");
        }
        const item = new LocMetadataItem();
        item.request = this;
        item.requestId = this.id;
        item.index = this.metadata!.length;
        item.name = itemDescription.name;
        item.nameHash = nameHash;
        item.value = itemDescription.value;
        item.lifecycle = EmbeddableLifecycle.fromSubmissionType(submissionType);
        item.submitter = EmbeddableSupportedAccountId.from(itemDescription.submitter);
        item._toAdd = true;
        this.metadata!.push(item);
    }

    getMetadataItem(nameHash: Hash): MetadataItemDescription {
        return this.toMetadataItemDescription(this.metadataItem(nameHash)!)
    }

    private toMetadataItemDescription(item: LocMetadataItem): MetadataItemDescription {
        return ({
            nameHash: item.nameHash!,
            name: item.name!,
            value: item.value!,
            submitter: item.submitter!.toSupportedAccountId(),
            fees: item.inclusionFee ? new Fees({ inclusionFee: BigInt(item.inclusionFee)}) : undefined,
            ...(item.lifecycle!.getDescription()),
        })
    }

    getMetadataItems(viewerAddress?: SupportedAccountId): MetadataItemDescription[] {
        return orderAndMap(this.metadata?.filter(item => this.itemViewable(item, viewerAddress)), this.toMetadataItemDescription);
    }

    setMetadataItemAddedOn(nameHash: Hash, addedOn: Moment) {
        const metadataItem = this.metadataItem(nameHash)
        if (!metadataItem) {
            logger.error(`MetadataItem with nameHash ${ nameHash } not found`);
            return;
        }
        metadataItem.lifecycle?.setAddedOn(addedOn);
        metadataItem._toUpdate = true;
    }

    removeMetadataItem(remover: SupportedAccountId, nameHash: Hash): void {
        this.ensureEditable();
        const removedItemIndex: number = this.metadata!.findIndex(link => link.nameHash?.equalTo(nameHash));
        if (removedItemIndex === -1) {
            throw new Error("No metadata item with given name");
        }
        const removedItem: LocMetadataItem = this.metadata![removedItemIndex];
        if (!this.canRemove(remover, removedItem)) {
            throw new Error("Item removal not allowed");
        }
        if (removedItem.status === "ACKNOWLEDGED" || removedItem.status === 'PUBLISHED') {
            throw new Error("Only draft metadata can be removed");
        }
        deleteIndexedChild(removedItemIndex, this.metadata!, this._metadataToDelete)
    }

    private canRemove(address: SupportedAccountId, item: Submitted): boolean {
        return this.isOwner(address) || accountEquals(address, item.submitter);
    }

    requestMetadataItemReview(nameHash: Hash) {
        this.mutateMetadataItem(nameHash, item => item.lifecycle!.requestReview());
    }

    acceptMetadataItem(nameHash: Hash) {
        this.ensureCanAcceptOrReject();
        this.mutateMetadataItem(nameHash, item => item.lifecycle!.accept());
    }

    rejectMetadataItem(nameHash: Hash, reason: string) {
        this.ensureCanAcceptOrReject();
        this.mutateMetadataItem(nameHash, item => item.lifecycle!.reject(reason));
    }

    prePublishOrAcknowledgeMetadataItem(nameHash: Hash, contributor: SupportedAccountId) {
        if(!this.canPrePublishOrAcknowledgeMetadataItem(nameHash, contributor)) {
            throw new Error("Contributor cannot confirm");
        }
        this.mutateMetadataItem(nameHash, item => item.lifecycle!.prePublishOrAcknowledge(item.submitter?.type !== "Polkadot" || this.isOwner(item.submitter.toSupportedAccountId())));
    }

    canPreAcknowledgeMetadataItem(nameHash: Hash, contributor: SupportedAccountId): boolean {
        const metadata = this.getMetadataOrThrow(nameHash);
        return this.canPreAcknowledge(metadata, contributor);
    }

    canPrePublishOrAcknowledgeMetadataItem(nameHash: Hash, contributor: SupportedAccountId): boolean {
        this.ensureOpen();
        const metadata = this.getMetadataOrThrow(nameHash);
        return this.canPrePublishOrAcknowledge(metadata, contributor);
    }

    getMetadataOrThrow(nameHash: Hash) {
        return requireDefined(
            this.metadataItem(nameHash),
            () => badRequest(`Metadata Item not found: ${ nameHash }`)
        );
    }

    preAcknowledgeMetadataItem(nameHash: Hash, contributor: SupportedAccountId, acknowledgedOn?: Moment) {
        this.mutateMetadataItem(nameHash, item => item.lifecycle!.preAcknowledge(
            this.isVerifiedIssuer(item.submitter?.toSupportedAccountId()),
            this.isVerifiedIssuer(contributor),
            acknowledgedOn
        ))
    }

    private mutateMetadataItem(nameHash: Hash, mutator: (item: LocMetadataItem) => void) {
        const metadataItem = this.getMetadataOrThrow(nameHash);
        mutator(metadataItem);
        metadataItem._toUpdate = true;
    }

    hasMetadataItem(nameHash: Hash): boolean {
        return this.metadataItem(nameHash) !== undefined;
    }

    metadataItem(nameHash: Hash): LocMetadataItem | undefined {
        return this.metadata!.find(metadataItem => metadataItem.nameHash?.equalTo(nameHash))
    }

    setFileAddedOn(hash: Hash, addedOn: Moment) {
        const file = this.file(hash);
        if (!file) {
            logger.error(`File with hash ${ hash } not found`);
            return;
        }
        file.lifecycle?.setAddedOn(addedOn);
        file._toUpdate = true;
    }

    removeFile(removerAddress: SupportedAccountId, hash: Hash): FileDescription {
        this.ensureEditable();
        const removedFileIndex: number = this.files!.findIndex(file => file.hash === hash.toHex());
        if (removedFileIndex === -1) {
            throw new Error("No file with given hash");
        }
        const removedFile: LocFile = this.files![removedFileIndex];
        if (!this.canRemove(removerAddress, removedFile)) {
            throw new Error("Item removal not allowed");
        }
        if (removedFile.status === "ACKNOWLEDGED" || removedFile.status === 'PUBLISHED') {
            throw new Error("Only draft files can be removed");
        }
        deleteIndexedChild(removedFileIndex, this.files!, this._filesToDelete)
        return this.toFileDescription(removedFile);
    }

    addLink(itemDescription: LinkParams, submissionType: SubmissionType) {
        this.ensureEditable(submissionType);
        if (this.hasLink(itemDescription.target)) {
            throw new Error("A link with given target was already added to this LOC");
        }
        const item = new LocLink();
        item.request = this;
        item.requestId = this.id;
        item.index = this.links!.length;
        item.target = itemDescription.target;
        item.nature = itemDescription.nature
        item.lifecycle = EmbeddableLifecycle.fromSubmissionType(submissionType);
        item.submitter = EmbeddableSupportedAccountId.from(itemDescription.submitter);
        item._toAdd = true;
        this.links!.push(item);
    }

    getLink(name: string): LinkDescription {
        return this.toLinkDescription(this.link(name)!)
    }

    private toLinkDescription(link: LocLink): LinkDescription {
        return {
            target: link.target!,
            nature: link.nature!,
            submitter: link.submitter!.toSupportedAccountId(),
            fees: link.inclusionFee ? new Fees({ inclusionFee: BigInt(link.inclusionFee)}) : undefined,
            ...(link.lifecycle!.getDescription()),
        }
    }

    getLinks(viewerAddress?: SupportedAccountId): LinkDescription[] {
        return orderAndMap(this.links?.filter(link => this.itemViewable(link, viewerAddress)), this.toLinkDescription);
    }

    setLinkAddedOn(target: string, addedOn: Moment) {
        const link = this.link(target);
        if (!link) {
            logger.error(`Link with target ${ target } not found`);
            return;
        }
        link.lifecycle?.setAddedOn(addedOn);
        link._toUpdate = true;
    }

    removeLink(remover: SupportedAccountId, target: string): void {
        this.ensureEditable();
        const removedLinkIndex: number = this.links!.findIndex(link => link.target === target);
        if (removedLinkIndex === -1) {
            throw new Error("No link with given target");
        }
        const removedLink: LocLink = this.links![removedLinkIndex];
        if (!this.canRemove(remover, removedLink)) {
            throw new Error("Item removal not allowed");
        }
        if (removedLink.status === "ACKNOWLEDGED" || removedLink.status === 'PUBLISHED') {
            throw new Error("Only draft links can be removed");
        }
        deleteIndexedChild(removedLinkIndex, this.links!, this._linksToDelete)
    }

    requestLinkReview(target: string) {
        this.mutateLink(target, item => item.lifecycle!.requestReview());
    }

    acceptLink(target: string) {
        this.ensureCanAcceptOrReject();
        this.mutateLink(target, item => item.lifecycle!.accept());
    }

    rejectLink(target: string, reason: string) {
        this.ensureCanAcceptOrReject();
        this.mutateLink(target, item => item.lifecycle!.reject(reason));
    }

    prePublishOrAcknowledgeLink(target: string, contributor: SupportedAccountId) {
        if (!this.canPrePublishOrAcknowledgeLink(target, contributor)) {
            throw new Error("Contributor cannot confirm");
        }
        this.mutateLink(target, link => link.lifecycle!.prePublishOrAcknowledge(link.submitter?.type !== "Polkadot" || this.isOwner(link.submitter.toSupportedAccountId())));
    }

    preAcknowledgeLink(target: string, contributor: SupportedAccountId, acknowledgedOn?: Moment) {
        this.mutateLink(target, link => link.lifecycle!.preAcknowledge(
            this.isVerifiedIssuer(link.submitter?.toSupportedAccountId()),
            this.isVerifiedIssuer(contributor),
            acknowledgedOn
        ))
    }

    canPrePublishOrAcknowledgeLink(target: string, contributor: SupportedAccountId): boolean {
        this.ensureOpen();
        const link = this.getLinkOrThrow(target);
        return this.canPrePublishOrAcknowledge(link, contributor);
    }

    canPreAcknowledgeLink(target: string, contributor: SupportedAccountId): boolean {
        const link = this.getLinkOrThrow(target);
        return this.canPreAcknowledge(link, contributor);
    }

    getLinkOrThrow(target: string) {
        return requireDefined(
            this.link(target),
            () => badRequest(`Link with target ${ target } not found`)
        );
    }

    hasLink(target: string): boolean {
        return this.link(target) !== undefined;
    }

    link(target: string): LocLink | undefined {
        return this.links!.find(link => link.target === target)
    }

    private mutateLink(target: string, mutator: (link: LocLink) => void) {
        const link = this.getLinkOrThrow(target);
        mutator(link);
        link._toUpdate = true;
    }

    preVoid(reason: string) {
        if (this.isVoid()) {
            throw new Error("LOC is already void")
        }
        this.voidInfo = new EmbeddableVoidInfo();
        this.voidInfo.reason = reason;
    }

    isVoid(): boolean {
        return this.voidInfo !== undefined && (this.voidInfo.reason !== null && this.voidInfo.reason !== undefined);
    }

    voidLoc(timestamp: Moment) {
        if (this.voidInfo && this.voidInfo.voidedOn) {
            logger.warn("LOC is already void");
        }
        if (!this.voidInfo) {
            this.voidInfo = new EmbeddableVoidInfo();
            this.voidInfo.reason = "";
        }
        this.voidInfo.voidedOn = timestamp.toISOString();
    }

    getVoidInfo(): VoidInfo | null {
        if (this.isVoid()) {
            return {
                reason: this.voidInfo?.reason || "",
                voidedOn: this.voidInfo?.voidedOn ? moment(this.voidInfo.voidedOn) : null
            };
        } else {
            return null;
        }
    }

    updateUserIdentity(userIdentity: UserIdentity | undefined) {
        this.userIdentity = EmbeddableUserIdentity.from(userIdentity);
    }

    updateUserPostalAddress(userPostalAddress: PostalAddress | undefined) {
        this.userPostalAddress = EmbeddablePostalAddress.from(userPostalAddress);
    }

    updateSealedPersonalInfo(personalInfo: PersonalInfo, seal: Seal) {
        const { userIdentity, userPostalAddress, company } = personalInfo;
        this.updateUserIdentity(userIdentity);
        this.updateUserPostalAddress(userPostalAddress)
        this.company = company;
        this.seal = EmbeddableSeal.from(seal);
    }

    isIdenfySessionInProgress(): boolean {
        return this.iDenfyVerification !== undefined && this.iDenfyVerification.status === "PENDING";
    }

    canInitIdenfyVerification(): { result: boolean, error?: string } {
        if(this.status !== "DRAFT") {
            return { result: false, error: "LOC must be draft" };
        }
        if(this.locType !== "Identity") {
            return { result: false, error: "Not an identity LOC" };
        }
        if(this.iDenfyVerification?.status === "PENDING") {
            return { result: false, error: "A verification is already in progress" };
        }
        if(this.iDenfyVerification?.status === "APPROVED") {
            return { result: false, error: "A previous verification was already approved" };
        }
        return { result: true };
    }

    initIdenfyVerification(session: IdenfyVerificationSession) {
        this.iDenfyVerification = new EmbeddableIdenfyVerification();
        this.iDenfyVerification.authToken = session.authToken;
        this.iDenfyVerification.scanRef = session.scanRef;
        this.iDenfyVerification.status = 'PENDING';
    }

    updateIdenfyVerification(payload: IdenfyCallbackPayload, rawJson: string) {
        if(!this.iDenfyVerification || this.iDenfyVerification.status !== 'PENDING') {
            throw new Error("iDenfy verification was not initiated");
        }
        if(payload.final) {
            this.iDenfyVerification.status = payload.status.overall;
            this.iDenfyVerification.callbackPayload = rawJson;
        }
    }

    addDeliveredFile(params: {
        hash: Hash,
        deliveredFileHash: Hash,
        generatedOn: Moment,
        owner: string,
    }): void {
        if(this.locType !== "Collection") {
            throw new Error("Restricted delivery is only available with Collection LOCs");
        }
        if(this.status !== "CLOSED") {
            throw new Error("Restricted delivery is only possible with closed Collection LOCs");
        }
        const { hash, deliveredFileHash, generatedOn, owner } = params;
        const file = this.getFileOrThrow(hash);
        file.addDeliveredFile({
            deliveredFileHash,
            generatedOn,
            owner,
        });
    }

    setFileRestrictedDelivery(params: {
        hash: Hash,
        restrictedDelivery: boolean,
    }): void {
        if(this.locType !== 'Collection') {
            throw Error("Can change restricted delivery of file only on Collection LOC.");
        }
        const { hash, restrictedDelivery } = params;
        const file = this.getFileOrThrow(hash);
        file.setRestrictedDelivery(restrictedDelivery);
    }

    setFileFees(hash: Hash, fees: Fees, storageFeePaidBy: string | undefined) {
        const file = this.getFileOrThrow(hash);
        file.setFees(fees, storageFeePaidBy);
    }

    setMetadataItemFee(nameHash: Hash, inclusionFee: bigint) {
        const metadata = this.metadataItem(nameHash);
        if (!metadata) {
            logger.error(`Data with nameHash ${ nameHash } not found`);
            return;
        }
        metadata.setFee(inclusionFee);
    }

    setLinkFee(target: string, inclusionFee: bigint) {
        const link = this.link(target);
        if (!link) {
            logger.error(`Link with target ${ target } not found`);
            return;
        }
        link.setFee(inclusionFee);
    }

    getOwner(): SupportedAccountId {
        return polkadotAccount(this.ownerAddress || "");
    }

    canOpen(user: SupportedAccountId | undefined): boolean {
        return user !== undefined
            && accountEquals(user, this.getRequester())
            && user.type === 'Polkadot'
            && (this.status === 'REVIEW_ACCEPTED' || this.status === 'OPEN')
    }

    @PrimaryColumn({ type: "uuid" })
    id?: string;

    @Column({ length: 255 })
    status?: LocRequestStatus;

    @Column({ length: 255, name: "requester_address", nullable: true })
    requesterAddress?: string;

    @Column({ length: 255, name: "requester_address_type", nullable: true })
    requesterAddressType?: string;

    @ManyToOne(() => LocRequestAggregateRoot, { nullable: true })
    @JoinColumn({ name: "requester_identity_loc" })
    _requesterIdentityLoc?: LocRequestAggregateRoot;

    @Column({ name: "requester_identity_loc", nullable: true })
    requesterIdentityLocId?: string;

    @Column({ length: 255, name: "owner_address" })
    ownerAddress?: string;

    @Column({ length: 255, name: "description" })
    description?: string;

    @Column({ length: 255, name: "loc_type" })
    locType?: LocType;

    @Column("timestamp without time zone", { name: "decision_on", nullable: true })
    decisionOn?: string | null;

    @Column("varchar", { length: 255, name: "reject_reason", nullable: true })
    rejectReason?: string | null;

    @Column("timestamp without time zone", { name: "created_on", nullable: true })
    createdOn?: string | null;

    @Column("timestamp without time zone", { name: "closed_on", nullable: true })
    closedOn?: string | null;

    @Column("timestamp without time zone", { name: "loc_created_on", nullable: true })
    locCreatedOn?: string | null;

    @Column(() => EmbeddableUserIdentity, { prefix: "" })
    userIdentity?: EmbeddableUserIdentity;

    @Column(() => EmbeddablePostalAddress, { prefix: "" })
    userPostalAddress?: EmbeddablePostalAddress;

    @Column("varchar", { length: 255, name: "company", nullable: true })
    company?: string | null;

    @OneToMany(() => LocFile, file => file.request, {
        eager: true,
        cascade: false,
        persistence: false
    })
    files?: LocFile[];

    @OneToMany(() => LocMetadataItem, item => item.request, {
        eager: true,
        cascade: false,
        persistence: false
    })
    metadata?: LocMetadataItem[];

    @OneToMany(() => LocLink, item => item.request, {
        eager: true,
        cascade: false,
        persistence: false
    })
    links?: LocLink[];

    @Column(() => EmbeddableVoidInfo, { prefix: "" })
    voidInfo?: EmbeddableVoidInfo;

    @Column(() => EmbeddableSeal, { prefix: ""} )
    seal?: EmbeddableSeal;

    @Column(() => EmbeddableIdenfyVerification, { prefix: ""} )
    iDenfyVerification?: EmbeddableIdenfyVerification;

    @Column({ length: 255, name: "template", nullable: true })
    template?: string;

    @Column({ type: "uuid", name: "sponsorship_id", nullable: true, unique: true })
    sponsorshipId?: string;

    @Column("numeric", { name: "value_fee", precision: AMOUNT_PRECISION, nullable: true })
    valueFee?: string;

    @Column("numeric", { name: "legal_fee", precision: AMOUNT_PRECISION, nullable: true })
    legalFee?: string;

    _filesToDelete: LocFile[] = [];
    _linksToDelete: LocLink[] = [];
    _metadataToDelete: LocMetadataItem[] = [];
}

@Entity("loc_request_file")
@Unique([ "requestId", "index" ])
export class LocFile extends Child implements HasIndex, Submitted {

    @PrimaryColumn({ type: "uuid", name: "request_id" })
    requestId?: string;

    @PrimaryColumn({ name: "hash" })
    hash?: string;

    @Column({ name: "index" })
    index?: number;

    @Column({ length: 255 })
    name?: string;

    @Column("int4", { nullable: true })
    oid?: number;

    @Column({ length: 255, nullable: true })
    cid?: string;

    @Column({ length: 255, name: "content_type", nullable: true })
    contentType?: string;

    @Column({ length: 255, nullable: true })
    nature?: string;

    @Column(() => EmbeddableSupportedAccountId, { prefix: "submitter" })
    submitter?: EmbeddableSupportedAccountId;

    @ManyToOne(() => LocRequestAggregateRoot, request => request.files)
    @JoinColumn({ name: "request_id", referencedColumnName: "id" })
    request?: LocRequestAggregateRoot; // WARNING: TypeORM does not set this field!

    @Column("boolean", { name: "restricted_delivery", default: false })
    restrictedDelivery?: boolean;

    @Column("bigint", { nullable: false })
    size?: string;

    @OneToMany(() => LocFileDelivered, deliveredFile => deliveredFile.file, {
        eager: true,
        cascade: false,
        persistence: false,
    })
    delivered?: LocFileDelivered[];

    @Column(() => EmbeddableStorageFees, { prefix: ""} )
    fees?: EmbeddableStorageFees;

    @Column({ length: 255, name: "storage_fee_paid_by", nullable: true })
    storageFeePaidBy?: string;

    @Column(() => EmbeddableLifecycle, { prefix: "" })
    lifecycle?: EmbeddableLifecycle

    get status(): ItemStatus | undefined {
        return this.lifecycle?.status;
    }

    setRestrictedDelivery(restrictedDelivery: boolean) {
        this.restrictedDelivery = restrictedDelivery;
        this._toUpdate = true;
    }

    addDeliveredFile(params: {
        deliveredFileHash: Hash,
        generatedOn: Moment,
        owner: string,
    }): LocFileDelivered {
        const { deliveredFileHash, generatedOn, owner } = params;
        const deliveredFile = new LocFileDelivered();

        deliveredFile.requestId = this.requestId;
        deliveredFile.hash = this.hash;

        deliveredFile.deliveredFileHash = deliveredFileHash.toHex();
        deliveredFile.generatedOn = generatedOn.toDate();
        deliveredFile.owner = owner;

        deliveredFile.file = this;
        deliveredFile._toAdd = true;
        this.delivered?.push(deliveredFile);
        return deliveredFile;
    }

    setFees(fees: Fees, storageFeePaidBy: string | undefined) {
        this.fees = EmbeddableStorageFees.allFees(fees);
        this.storageFeePaidBy = storageFeePaidBy;
        this._toUpdate = true;
    }

    set status(status: ItemStatus | undefined) {
        if (!this.lifecycle) {
            this.lifecycle = EmbeddableLifecycle.default(status);
        } else {
            this.lifecycle.status = status;
        }
        this._toUpdate = true;
    }
}

@Entity("loc_request_file_delivered")
@Index([ "requestId", "hash" ])
export class LocFileDelivered extends Child {

    @PrimaryColumn({ type: "uuid", name: "id", default: () => "gen_random_uuid()", generated: "uuid" })
    id?: string;

    @Column({ type: "uuid", name: "request_id" })
    requestId?: string;

    @Column({ name: "hash" })
    hash?: string;

    @Column({ name: "delivered_file_hash", length: 255 })
    deliveredFileHash?: string;

    @Column("timestamp without time zone", { name: "generated_on", nullable: true })
    generatedOn?: Date;

    @Column({ length: 255 })
    owner?: string;

    @ManyToOne(() => LocFile, file => file.delivered)
    @JoinColumn([
        { name: "request_id", referencedColumnName: "requestId" },
        { name: "hash", referencedColumnName: "hash" },
    ])
    file?: LocFile;
}

@Entity("loc_metadata_item")
@Unique([ "requestId", "index" ])
export class LocMetadataItem extends Child implements HasIndex, Submitted {

    @PrimaryColumn({ type: "uuid", name: "request_id" })
    requestId?: string;

    @Column({ name: "index" })
    index?: number;

    @PrimaryColumn({ name: "name_hash", type: "bytea", transformer: HashTransformer.instance })
    nameHash?: Hash;

    @Column({ length: 255, nullable: true })
    name?: string;

    @Column("text", { name: "value", default: "", nullable: true })
    value?: string;

    @Column(() => EmbeddableSupportedAccountId, { prefix: "submitter" })
    submitter?: EmbeddableSupportedAccountId;

    @ManyToOne(() => LocRequestAggregateRoot, request => request.metadata)
    @JoinColumn({ name: "request_id" })
    request?: LocRequestAggregateRoot;

    @Column("numeric", { name: "inclusion_fee", precision: AMOUNT_PRECISION, nullable: true })
    inclusionFee?: string;

    setFee(inclusionFee: bigint) {
        this.inclusionFee = inclusionFee.toString();
        this._toUpdate = true;
    }

    @Column(() => EmbeddableLifecycle, { prefix: "" })
    lifecycle?: EmbeddableLifecycle

    get status(): ItemStatus | undefined {
        return this.lifecycle?.status;
    }

    set status(status: ItemStatus | undefined) {
        if (!this.lifecycle) {
            this.lifecycle = EmbeddableLifecycle.default(status);
        } else {
            this.lifecycle.status = status;
        }
        this._toUpdate = true;
    }
}

interface Submitted {
    submitter?: EmbeddableSupportedAccountId;
}

@Entity("loc_link")
@Unique([ "requestId", "index" ])
export class LocLink extends Child implements HasIndex, Submitted {

    @PrimaryColumn({ type: "uuid", name: "request_id" })
    requestId?: string;

    @Column({ name: "index" })
    index?: number;

    @PrimaryColumn({ type: "uuid" })
    target?: string;

    @Column({ length: 255, nullable: true })
    nature?: string;

    @ManyToOne(() => LocRequestAggregateRoot, request => request.links)
    @JoinColumn({ name: "request_id" })
    request?: LocRequestAggregateRoot;

    @Column("numeric", { name: "inclusion_fee", precision: AMOUNT_PRECISION, nullable: true })
    inclusionFee?: string;

    setFee(inclusionFee: bigint) {
        this.inclusionFee = inclusionFee.toString();
        this._toUpdate = true;
    }

    @Column(() => EmbeddableSupportedAccountId, { prefix: "submitter" })
    submitter?: EmbeddableSupportedAccountId;

    @Column(() => EmbeddableLifecycle, { prefix: "" })
    lifecycle?: EmbeddableLifecycle

    get status(): ItemStatus | undefined {
        return this.lifecycle?.status;
    }

    set status(status: ItemStatus | undefined) {
        if (!this.lifecycle) {
            this.lifecycle = EmbeddableLifecycle.default(status);
        } else {
            this.lifecycle.status = status;
        }
        this._toUpdate = true;
    }
}

export interface FetchLocRequestsSpecification {

    readonly expectedRequesterAddress?: string;
    readonly expectedOwnerAddress?: string;
    readonly expectedStatuses?: LocRequestStatus[];
    readonly expectedLocTypes?: LocType[];
    readonly expectedIdentityLocType?: IdentityLocType;
    readonly expectedSponsorshipId?: UUID;
}

@injectable()
export class LocRequestRepository {

    constructor() {
        this.repository = appDataSource.getRepository(LocRequestAggregateRoot);
        this.deliveredRepository = appDataSource.getRepository(LocFileDelivered);
    }

    readonly repository: Repository<LocRequestAggregateRoot>;
    readonly deliveredRepository: Repository<LocFileDelivered>;

    public findById(id: string): Promise<LocRequestAggregateRoot | null> {
        return this.repository.findOneBy({ id });
    }

    public async save(root: LocRequestAggregateRoot): Promise<void> {
        await this.repository.manager.save(root);
        await this.saveFiles(this.repository.manager, root)
        await this.saveMetadata(this.repository.manager, root)
        await this.saveLinks(this.repository.manager, root)
    }

    private async saveFiles(entityManager: EntityManager, root: LocRequestAggregateRoot): Promise<void> {
        const whereExpression: <E extends WhereExpressionBuilder>(sql: E, file: LocFile) => E = (sql, file) => sql
            .where("request_id = :id", { id: root.id })
            .andWhere("hash = :hash", { hash: file.hash });
        const allDelivered = root.files?.map(file => file.delivered);
        await saveIndexedChildren({
            children: root.files!,
            entityManager,
            entityClass: LocFile,
            whereExpression,
            childrenToDelete: root._filesToDelete,
            updateValuesExtractor: file => {
                const values = { ...file };
                delete values.delivered;
                return values;
            }
        });
        if(allDelivered) {
            for(const delivered of allDelivered) {
                await this.saveDelivered(delivered);
            }
        }
    }

    private async saveDelivered(delivered?: LocFileDelivered[]): Promise<void> {
        await saveChildren({
            children: delivered,
            entityManager: this.repository.manager,
            entityClass: LocFileDelivered,
        });
    }

    private async saveMetadata(entityManager: EntityManager, root: LocRequestAggregateRoot): Promise<void> {
        const whereExpression: <E extends WhereExpressionBuilder>(sql: E, item: LocMetadataItem) => E = (sql, item) => sql
            .where("request_id = :id", { id: root.id })
            .andWhere("name = :name", { name: item.name })
        await saveIndexedChildren({
            children: root.metadata!,
            entityManager,
            entityClass: LocMetadataItem,
            whereExpression,
            childrenToDelete: root._metadataToDelete
        })
    }

    private async saveLinks(entityManager: EntityManager, root: LocRequestAggregateRoot): Promise<void> {
        const whereExpression: <E extends WhereExpressionBuilder>(sql: E, link: LocLink) => E = (sql, link) => sql
            .where("request_id = :id", { id: root.id })
            .andWhere("target = :target", { target: link.target })
        await saveIndexedChildren({
            children: root.links!,
            entityManager,
            entityClass: LocLink,
            whereExpression,
            childrenToDelete: root._linksToDelete
        })
    }

    public async findBy(specification: FetchLocRequestsSpecification): Promise<LocRequestAggregateRoot[]> {
        let builder = this.createQueryBuilder(specification)
            .leftJoinAndSelect("request.files", "file")
            .leftJoinAndSelect("file.delivered", "delivered")
            .leftJoinAndSelect("request.metadata", "metadata_item")
            .leftJoinAndSelect("request.links", "link");

        builder
            .orderBy("request.voided_on", "DESC", "NULLS FIRST")
            .addOrderBy("request.closed_on", "DESC", "NULLS FIRST")
            .addOrderBy("request.loc_created_on", "DESC", "NULLS FIRST")
            .addOrderBy("request.decision_on", "DESC", "NULLS FIRST")
            .addOrderBy("request.created_on", "DESC", "NULLS FIRST");

        return builder.getMany();
    }

    public async existsBy(specification: FetchLocRequestsSpecification): Promise<boolean> {
        return this.createQueryBuilder(specification).getExists();
    }

    public createQueryBuilder(specification: FetchLocRequestsSpecification): SelectQueryBuilder<LocRequestAggregateRoot> {
        let builder = this.repository.createQueryBuilder("request")

        if (specification.expectedRequesterAddress) {
            builder.andWhere("request.requester_address = :expectedRequesterAddress",
                { expectedRequesterAddress: specification.expectedRequesterAddress });
        }

        if (specification.expectedOwnerAddress) {
            builder.andWhere("request.owner_address = :expectedOwnerAddress",
                { expectedOwnerAddress: specification.expectedOwnerAddress });
        }

        if (specification.expectedStatuses && specification.expectedStatuses.length > 0) {
            builder.andWhere("request.status IN (:...expectedStatuses)",
                { expectedStatuses: specification.expectedStatuses });
        }

        if (specification.expectedLocTypes && specification.expectedLocTypes.length > 0) {
            builder.andWhere("request.loc_type IN (:...expectedLocTypes)",
                { expectedLocTypes: specification.expectedLocTypes });
        }

        if (specification.expectedIdentityLocType) {
            if (specification.expectedIdentityLocType !== "Logion") {
                builder
                    .andWhere("request.requester_address IS NOT NULL")
                    .andWhere("request.requester_address_type = :expectedIdentityLocType",
                        { expectedIdentityLocType: specification.expectedIdentityLocType });
            } else {
                builder.andWhere("request.requester_address IS NULL")
            }
        }

        if (specification.expectedSponsorshipId) {
            builder.andWhere("request.sponsorship_id = :expectedSponsorshipId",
                {expectedSponsorshipId: specification.expectedSponsorshipId.toString() });
        }

        builder
            .orderBy("request.voided_on", "DESC", "NULLS FIRST")
            .addOrderBy("request.closed_on", "DESC", "NULLS FIRST")
            .addOrderBy("request.loc_created_on", "DESC", "NULLS FIRST")
            .addOrderBy("request.decision_on", "DESC", "NULLS FIRST")
            .addOrderBy("request.created_on", "DESC", "NULLS FIRST");

        return builder;
    }

    async deleteDraftRejectedOrAccepted(request: LocRequestAggregateRoot): Promise<void> {
        if(request.status !== "DRAFT" && request.status !== "REVIEW_REJECTED" && request.status !== "REVIEW_ACCEPTED") {
            throw new Error("Cannot delete non-draft and non-reviewed request");
        }

        await this.repository.manager.delete(LocFile, { requestId: request.id });
        await this.repository.manager.delete(LocMetadataItem, { requestId: request.id });
        await this.repository.manager.delete(LocLink, { requestId: request.id });
        await this.repository.manager.delete(LocRequestAggregateRoot, request.id);
    }

    public async findAllDeliveries(query: { collectionLocId: string, hash?: Hash }): Promise<Record<string, LocFileDelivered[]>> {
        const { collectionLocId, hash } = query;
        let builder = this.deliveredRepository.createQueryBuilder("delivery");
        builder.where("delivery.request_id = :collectionLocId", { collectionLocId });
        if (hash) {
            builder.andWhere("delivery.hash = :hash", { hash: hash.toHex() });
        }
        builder.orderBy("delivery.generated_on", "DESC");
        const deliveriesList = await builder.getMany();
        const deliveries: Record<string, LocFileDelivered[]> = {};
        for(const delivery of deliveriesList) {
            const hash = delivery.hash!;
            deliveries[hash] ||= [];
            const fileDeliveries = deliveries[hash];
            fileDeliveries.push(delivery);
        }
        return deliveries;
    }

    public async findDeliveryByDeliveredFileHash(query: { collectionLocId: string, deliveredFileHash: Hash }): Promise<LocFileDelivered | null> {
        const requestId = query.collectionLocId;
        const { deliveredFileHash } = query;
        return await this.deliveredRepository.findOneBy({ requestId, deliveredFileHash: deliveredFileHash.toHex() })
    }
}

export interface NewLocRequestParameters {
    readonly id: string;
    readonly description: LocRequestDescription;
}

export interface NewLocParameters extends NewLocRequestParameters {
    readonly metadata?: MetadataItemParams[];
    readonly links?: LinkParams[];
}

export interface NewUserLocRequestParameters extends NewLocRequestParameters {
    readonly draft: boolean;
}

export interface NewSofRequestParameters extends NewLocRequestParameters, LinkParams {
}

@injectable()
export class LocRequestFactory {

    constructor(
        private repository: LocRequestRepository,
        private sealService: PersonalInfoSealService,
    ) {
    }

    async newLOLocRequest(params: NewLocRequestParameters): Promise<LocRequestAggregateRoot> {
        this.ensureCorrectRequester(params.description, true);
        return await this.createLocRequest({ ...params, draft: false }, "MANUAL_BY_OWNER");
    }

    async newSofRequest(params: NewSofRequestParameters): Promise<LocRequestAggregateRoot> {
        this.ensureCorrectRequester(params.description, false);
        const request = await this.createLocRequest({
            ...params,
            draft: true,
            description: {
                ...params.description,
                template: "statement_of_facts"
            }
        }, "MANUAL_BY_USER");
        request.addLink(params, "MANUAL_BY_USER");
        request.submit();
        return request;
    }

    async newLoc(params: NewLocParameters): Promise<LocRequestAggregateRoot> {
        this.ensureCorrectRequester(params.description, false);
        const request = await this.createLocRequest({ ...params, draft: false }, "DIRECT_BY_REQUESTER")
        params.metadata?.forEach(item => request.addMetadataItem(item, "DIRECT_BY_REQUESTER"))
        params.links?.forEach(item => request.addLink(item, "DIRECT_BY_REQUESTER"))
        return request;
    }

    async newLocRequest(params: NewUserLocRequestParameters): Promise<LocRequestAggregateRoot> {
        this.ensureCorrectRequester(params.description, false);
        return this.createLocRequest(params, "MANUAL_BY_USER");
    }

    private populateIdentity(request: LocRequestAggregateRoot, description: LocRequestDescription) {
        const userIdentity = description.userIdentity || {
            firstName: "",
            lastName: "",
            email: "",
            phoneNumber: "",
            company: false,
        }
        const userPostalAddress = description.userPostalAddress || {
            line1: "",
            line2: "",
            postalCode: "",
            city: "",
            country: ""
        }
        const company = description.company;
        const personalInfo: PersonalInfo = { userIdentity, userPostalAddress, company }
        const seal = this.sealService.seal(personalInfo, LATEST_SEAL_VERSION);
        request.updateSealedPersonalInfo(personalInfo, seal);
    }

    private async createLocRequest(params: NewUserLocRequestParameters, submissionType: SubmissionType): Promise<LocRequestAggregateRoot> {
        const { description } = params;

        const request = new LocRequestAggregateRoot();
        request.id = params.id;

        const nonDraftStatus = submissionType === "MANUAL_BY_USER" ?
            "REVIEW_PENDING" :
            "OPEN";
        request.status = params.draft ? "DRAFT" : nonDraftStatus;

        if (description.requesterAddress) {
            request.requesterAddress = description.requesterAddress.address;
            request.requesterAddressType = description.requesterAddress.type;
        }
        if (description.requesterIdentityLoc) {
            const identityLoc = await this.repository.findById(description.requesterIdentityLoc);
            request._requesterIdentityLoc = identityLoc ? identityLoc : undefined;
            request.requesterIdentityLocId = description.requesterIdentityLoc;
        }
        request.ownerAddress = description.ownerAddress;
        request.description = description.description;
        request.locType = description.locType;
        request.createdOn = description.createdOn;
        if (request.locType === 'Identity') {
            this.ensureUserIdentityPresent(description)
            this.populateIdentity(request, description);
        }
        request.files = [];
        request.metadata = [];
        request.links = [];
        request.template = description.template;
        request.sponsorshipId = description.sponsorshipId?.toString();
        if(request.locType === "Collection") {
            const valueFee = requireDefined(description.valueFee, () => new Error("Collection LOC must have a value fee"));
            request.valueFee = valueFee.toString();
        }
        request.legalFee = description.legalFee?.toString();
        return request;
    }

    private ensureCorrectRequester(description: LocRequestDescription, allowRequesterIdentityLoc: boolean) {
        if (!description.requesterAddress && !allowRequesterIdentityLoc) {
            throw new Error("UnexpectedRequester: Identity LOC cannot have a LOC as requester")
        }
        switch (description.locType) {
            case 'Identity':
                if (description.requesterIdentityLoc) {
                    throw new Error("UnexpectedRequester: Identity LOC cannot have a LOC as requester")
                }
                return;
            default:
                if (description.requesterAddress && description.requesterIdentityLoc) {
                    throw new Error("UnexpectedRequester: LOC cannot have both requester address and id loc")
                }
                if (!description.requesterAddress && !description.requesterIdentityLoc) {
                    throw new Error("UnexpectedRequester: LOC must have one requester")
                }
        }
    }

    private ensureUserIdentityPresent(description: LocRequestDescription) {
        const userIdentity = description.userIdentity;
        if (!userIdentity
            || !userIdentity.firstName
            || !userIdentity.lastName
            || !userIdentity.email
            || !userIdentity.phoneNumber
        ) {
            throw new Error("Logion Identity LOC request must contain first name, last name, email and phone number.")
        }
    }
}
