import { injectable } from "inversify";
import moment, { Moment } from "moment";
import { Entity, PrimaryColumn, Column, Repository, ManyToOne, JoinColumn, OneToMany, Unique, Index } from "typeorm";
import { WhereExpressionBuilder } from "typeorm/query-builder/WhereExpressionBuilder.js";
import { EntityManager } from "typeorm/entity-manager/EntityManager.js";
import { appDataSource, Log } from "@logion/rest-api-core";

import { components } from "../controllers/components.js";
import { EmbeddableUserIdentity, toUserIdentity, UserIdentity } from "./useridentity.js";
import { orderAndMap, HasIndex } from "../lib/db/collections.js";
import { deleteIndexedChild, Child, saveIndexedChildren, saveChildren } from "./child.js";
import { EmbeddablePostalAddress, PostalAddress } from "./postaladdress.js";
import { LATEST_SEAL_VERSION, PersonalInfoSealService, PublicSeal, Seal } from "../services/seal.service.js";
import { PersonalInfo } from "./personalinfo.model.js";
import { IdenfyCallbackPayload, IdenfyVerificationSession, IdenfyVerificationStatus } from "../services/idenfy/idenfy.types.js";

const { logger } = Log;

export type LocRequestStatus = components["schemas"]["LocRequestStatus"];
export type LocType = components["schemas"]["LocType"];
export type IdentityLocType = components["schemas"]["IdentityLocType"];

export interface LocRequestDescription {
    readonly requesterAddress?: string;
    readonly requesterIdentityLoc?: string;
    readonly ownerAddress: string;
    readonly description: string;
    readonly createdOn: string;
    readonly userIdentity: UserIdentity | undefined;
    readonly userPostalAddress: PostalAddress | undefined;
    readonly locType: LocType;
    readonly seal?: PublicSeal;
    readonly company?: string;
    readonly verifiedThirdParty: boolean;
}

export interface LocRequestDecision {
    readonly decisionOn: string;
    readonly rejectReason?: string;
}

export interface FileDescription {
    readonly name: string;
    readonly hash: string;
    readonly oid?: number;
    readonly cid?: string;
    readonly contentType: string;
    readonly nature: string;
    readonly addedOn?: Moment;
    readonly submitter: string;
    readonly restrictedDelivery: boolean;
}

export interface MetadataItemDescription {
    readonly name: string;
    readonly value: string;
    readonly addedOn?: Moment;
    readonly submitter: string;
}

export interface LinkDescription {
    readonly target: string;
    readonly nature: string;
    readonly addedOn?: Moment;
}

export interface VoidInfo {
    readonly reason: string;
    readonly voidedOn: Moment | null;
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
        result.hash = seal.hash;
        result.salt = seal.salt;
        result.version = seal.version;
        return result;
    }
}

function toPublicSeal(embedded: EmbeddableSeal | undefined): PublicSeal | undefined {
    return embedded && embedded.hash && embedded.version !== undefined && embedded.version !== null
        ?
        {
            hash: embedded.hash,
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
        this.status = 'REQUESTED';
    }

    reject(reason: string, rejectedOn: Moment): void {
        if (this.status != 'REQUESTED') {
            throw new Error("Cannot reject already decided request");
        }

        this.status = 'REJECTED';
        this.rejectReason = reason;
        this.decisionOn = rejectedOn.toISOString();
    }

    rework(): void {
        if (this.status != 'REJECTED') {
            throw new Error("Cannot rework a non-rejected request");
        }
        this.status = 'DRAFT';
    }

    accept(decisionOn: Moment): void {
        if (this.status != 'REQUESTED') {
            throw new Error("Cannot accept already decided request");
        }

        this.status = 'OPEN';
        this.decisionOn = decisionOn.toISOString();
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
            requesterAddress: this.requesterAddress,
            requesterIdentityLoc: this.requesterIdentityLocId,
            ownerAddress: this.ownerAddress!,
            description: this.description!,
            createdOn: this.createdOn!,
            userIdentity,
            userPostalAddress,
            locType: this.locType!,
            seal: toPublicSeal(this.seal),
            company: this.company!,
            verifiedThirdParty: this.verifiedThirdParty || false,
        }
    }

    getDecision(): LocRequestDecision | undefined {
        if (this.status !== 'REQUESTED') {
            return {
                decisionOn: this.decisionOn!,
                rejectReason: this.status === 'REJECTED' ? this.rejectReason! : undefined
            }
        }
    }

    addFile(fileDescription: FileDescription) {
        this.ensureEditable();
        if (this.hasFile(fileDescription.hash)) {
            throw new Error("A file with given hash was already added to this LOC");
        }
        const file = new LocFile();
        file.request = this;
        file.requestId = this.id;
        file.index = this.files!.length;
        file.name = fileDescription.name;
        file.hash! = fileDescription.hash;
        file.cid = fileDescription.cid;
        file.contentType = fileDescription.contentType;
        file.draft = true;
        file.nature = fileDescription.nature;
        file.submitter = fileDescription.submitter
        file.delivered = [];
        file._toAdd = true;
        this.files!.push(file);
    }

    private ensureEditable() {
        if (!(this.status === "DRAFT" || this.status === "OPEN")) {
            throw new Error("LOC is not editable");
        }
    }

    confirmFile(hash: string) {
        const file = this.getFileOrThrow(hash);
        file.draft = false;
        file._toUpdate = true;
    }

    private getFileOrThrow(hash: string) {
        const file = this.file(hash);
        if(!file) {
            throw new Error(`No file with hash ${hash}`);
        }
        return file;
    }

    private file(hash: string): LocFile | undefined {
        return this.files?.find(file => file.hash === hash);
    }

    hasFile(hash: string): boolean {
        return this.file(hash) !== undefined;
    }

    getFile(hash: string): FileDescription {
        return this.toFileDescription(this.getFileOrThrow(hash));
    }

    private toFileDescription(file: LocFile): FileDescription {
        return {
            name: file!.name!,
            contentType: file!.contentType!,
            hash: file!.hash!,
            oid: file!.oid,
            cid: file!.cid,
            nature: file!.nature!,
            submitter: file!.submitter!,
            addedOn: file!.addedOn !== undefined ? moment(file!.addedOn) : undefined,
            restrictedDelivery: file!.restrictedDelivery || false,
        };
    }

    private itemViewable(item: { draft?: boolean, submitter?: string }, viewerAddress?: string): boolean {
        return !item.draft ||
            viewerAddress === this.ownerAddress ||
            item.submitter === viewerAddress ||
            (viewerAddress !== undefined && viewerAddress === this.requesterAddress && item.submitter === this.ownerAddress);
    }

    getFiles(viewerAddress?: string): FileDescription[] {
        return orderAndMap(this.files?.filter(item => this.itemViewable(item, viewerAddress)), file => this.toFileDescription(file));
    }

    setLocCreatedDate(timestamp: Moment) {
        if (this.locCreatedOn) {
            logger.warn("LOC created date is already set");
        }
        this.locCreatedOn = timestamp.toISOString();
        if (this.status === "REQUESTED") {
            this.accept(timestamp);
        }
    }

    getLocCreatedDate(): Moment {
        return moment(this.locCreatedOn!);
    }

    preClose() {
        this.ensureOpen();
        this.status = 'CLOSED';
    }

    private ensureOpen(warnOnly: boolean = false) {
        if (this.status !== "OPEN") {
            if (warnOnly) {
                logger.warn("LOC is not open")
            } else {
                throw new Error("LOC is not open");
            }
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

    addMetadataItem(itemDescription: MetadataItemDescription) {
        this.ensureEditable();
        if (this.hasMetadataItem(itemDescription.name)) {
            throw new Error("A metadata item with given name was already added to this LOC");
        }
        const item = new LocMetadataItem();
        item.request = this;
        item.requestId = this.id;
        item.index = this.metadata!.length;
        item.name = itemDescription.name;
        item.value = itemDescription.value;
        item.draft = true;
        item.submitter = itemDescription.submitter;
        item._toAdd = true;
        this.metadata!.push(item);
    }

    getMetadataItem(name: string): MetadataItemDescription {
        return this.toMetadataItemDescription(this.metadataItem(name)!)
    }

    private toMetadataItemDescription(item: LocMetadataItem): MetadataItemDescription {
        return ({
            name: item.name!,
            value: item.value!,
            submitter: item.submitter!,
            addedOn: item.addedOn ? moment(item.addedOn) : undefined,
        })
    }

    getMetadataItems(viewerAddress?: string): MetadataItemDescription[] {
        return orderAndMap(this.metadata?.filter(item => this.itemViewable(item, viewerAddress)), this.toMetadataItemDescription);
    }

    setMetadataItemAddedOn(name: string, addedOn: Moment) {
        const metadataItem = this.metadataItem(name)
        if (!metadataItem) {
            logger.error(`MetadataItem with name ${ name } not found`);
            return;
        }
        if (metadataItem.addedOn) {
            logger.warn("MetadataItem added on date is already set");
        }
        metadataItem.addedOn = addedOn.toDate();
        metadataItem.draft = false;
        metadataItem._toUpdate = true;
    }

    removeMetadataItem(removerAddress: string, name: string): void {
        this.ensureEditable();
        const removedItemIndex: number = this.metadata!.findIndex(link => link.name === name);
        if (removedItemIndex === -1) {
            throw new Error("No metadata item with given name");
        }
        const removedItem: LocMetadataItem = this.metadata![removedItemIndex];
        if (!this.canRemove(removerAddress, removedItem)) {
            throw new Error("Item removal not allowed");
        }
        if (!removedItem.draft) {
            throw new Error("Only draft metadata can be removed");
        }
        deleteIndexedChild(removedItemIndex, this.metadata!, this._metadataToDelete)
    }

    private canRemove(address: string, item: Submitted | LocLink): boolean {
        if (item instanceof LocLink) {
            return address === this.ownerAddress;
        } else {
            return address === this.ownerAddress || address === item.submitter;
        }
    }

    confirmMetadataItem(name: string) {
        const metadataItem = this.metadataItem(name)!;
        metadataItem.draft = false;
        metadataItem._toUpdate = true;
    }

    hasMetadataItem(name: string): boolean {
        return this.metadataItem(name) !== undefined;
    }

    metadataItem(name: string): LocMetadataItem | undefined {
        return this.metadata!.find(metadataItem => metadataItem.name === name)
    }

    setFileAddedOn(hash: string, addedOn: Moment) {
        const file = this.file(hash);
        if (!file) {
            logger.error(`File with hash ${ hash } not found`);
            return;
        }
        if (file.addedOn) {
            logger.warn("File added on date is already set");
        }
        file.addedOn = addedOn.toDate();
        file.draft = false;
        file._toUpdate = true;
    }

    removeFile(removerAddress: string, hash: string): FileDescription {
        this.ensureEditable();
        const removedFileIndex: number = this.files!.findIndex(file => file.hash === hash);
        if (removedFileIndex === -1) {
            throw new Error("No file with given hash");
        }
        const removedFile: LocFile = this.files![removedFileIndex];
        if (!this.canRemove(removerAddress, removedFile)) {
            throw new Error("Item removal not allowed");
        }
        if (!removedFile.draft) {
            throw new Error("Only draft files can be removed");
        }
        deleteIndexedChild(removedFileIndex, this.files!, this._filesToDelete)
        return this.toFileDescription(removedFile);
    }

    addLink(itemDescription: LinkDescription) {
        this.ensureEditable();
        if (this.hasLink(itemDescription.target)) {
            throw new Error("A link with given target was already added to this LOC");
        }
        const item = new LocLink();
        item.request = this;
        item.requestId = this.id;
        item.index = this.links!.length;
        item.target = itemDescription.target;
        item.nature = itemDescription.nature
        item.draft = true;
        item._toAdd = true;
        this.links!.push(item);
    }

    getLink(name: string): LinkDescription {
        return this.toLinkDescription(this.link(name)!)
    }

    private toLinkDescription(item: LocLink): LinkDescription {
        return {
            target: item.target!,
            nature: item.nature!,
            addedOn: item.addedOn ? moment(item.addedOn) : undefined,
        }
    }

    getLinks(viewerAddress?: string): LinkDescription[] {
        return orderAndMap(this.links?.filter(link => !link.draft || this.ownerAddress === viewerAddress), this.toLinkDescription);
    }

    setLinkAddedOn(target: string, addedOn: Moment) {
        const link = this.link(target);
        if (!link) {
            logger.error(`Link with target ${ target } not found`);
            return;
        }
        if (link.addedOn) {
            logger.warn("Link added on date is already set");
        }
        link.addedOn = addedOn.toDate();
        link.draft = false;
        link._toUpdate = true;
    }

    removeLink(removerAddress: string, target: string): void {
        this.ensureEditable();
        const removedLinkIndex: number = this.links!.findIndex(link => link.target === target);
        if (removedLinkIndex === -1) {
            throw new Error("No link with given target");
        }
        const removedLink: LocLink = this.links![removedLinkIndex];
        if (!this.canRemove(removerAddress, removedLink)) {
            throw new Error("Item removal not allowed");
        }
        if (!removedLink.draft) {
            throw new Error("Only draft links can be removed");
        }
        deleteIndexedChild(removedLinkIndex, this.links!, this._linksToDelete)
    }

    confirmLink(target: string) {
        const link = this.link(target)!;
        link.draft = false;
        link._toUpdate = true;
    }

    hasLink(target: string): boolean {
        return this.link(target) !== undefined;
    }

    link(target: string): LocLink | undefined {
        return this.links!.find(link => link.target === target)
    }

    preVoid(reason: string) {
        if (this.voidInfo !== undefined && this.voidInfo.reason !== null) {
            throw new Error("LOC is already void")
        }
        this.voidInfo = new EmbeddableVoidInfo();
        this.voidInfo.reason = reason;
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
        if (this.voidInfo !== undefined && this.voidInfo.reason !== null) {
            return {
                reason: this.voidInfo.reason || "",
                voidedOn: this.voidInfo.voidedOn ? moment(this.voidInfo.voidedOn) : null
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

    setVerifiedThirdParty(verifiedThirdParty: boolean) {
        if(this.locType !== "Identity" || this.status !== "CLOSED" || !this.requesterAddress) {
            throw new Error("Verified third party flag can be set only on closed Polkadot Identity LOCs");
        }
        this.verifiedThirdParty = verifiedThirdParty;
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
        hash: string,
        deliveredFileHash: string,
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

    updateFile(params: {
        hash: string,
        restrictedDelivery: boolean,
    }): void {
        if(this.locType !== 'Collection') {
            throw Error("Can change restricted delivery of file only on Collection LOC.");
        }
        const { hash, restrictedDelivery } = params;
        const file = this.getFileOrThrow(hash);
        file.update(restrictedDelivery);
    }

    @PrimaryColumn({ type: "uuid" })
    id?: string;

    @Column({ length: 255 })
    status?: LocRequestStatus;

    @Column({ length: 255, name: "requester_address", nullable: true })
    requesterAddress?: string;

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

    @Column("boolean", { name: "verified_third_party", default: false })
    verifiedThirdParty?: boolean;

    @Column(() => EmbeddableIdenfyVerification, { prefix: ""} )
    iDenfyVerification?: EmbeddableIdenfyVerification;

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

    @Column("timestamp without time zone", { name: "added_on", nullable: true })
    addedOn?: Date;

    @Column({ length: 255 })
    name?: string;

    @Column("int4", { nullable: true })
    oid?: number;

    @Column({ length: 255, nullable: true })
    cid?: string;

    @Column({ length: 255, name: "content_type" })
    contentType?: string;

    @Column("boolean")
    draft?: boolean;

    @Column({ length: 255, nullable: true })
    nature?: string;

    @Column({ length: 255 })
    submitter?: string;

    @ManyToOne(() => LocRequestAggregateRoot, request => request.files)
    @JoinColumn({ name: "request_id", referencedColumnName: "id" })
    request?: LocRequestAggregateRoot; // WARNING: TypeORM does not set this field!

    @Column("boolean", { name: "restricted_delivery", default: false })
    restrictedDelivery?: boolean;

    @OneToMany(() => LocFileDelivered, deliveredFile => deliveredFile.file, {
        eager: true,
        cascade: false,
        persistence: false
    })
    delivered?: LocFileDelivered[];

    update(restrictedDelivery: boolean) {
        this.restrictedDelivery = restrictedDelivery;
        this._toUpdate = true;
    }

    addDeliveredFile(params: {
        deliveredFileHash: string,
        generatedOn: Moment,
        owner: string,
    }): LocFileDelivered {
        const { deliveredFileHash, generatedOn, owner } = params;
        const deliveredFile = new LocFileDelivered();

        deliveredFile.requestId = this.requestId;
        deliveredFile.hash = this.hash;

        deliveredFile.deliveredFileHash = deliveredFileHash;
        deliveredFile.generatedOn = generatedOn.toDate();
        deliveredFile.owner = owner;

        deliveredFile.file = this;
        deliveredFile._toAdd = true;
        this.delivered?.push(deliveredFile);
        return deliveredFile;
    }
}

@Entity("loc_request_file_delivered")
@Index([ "requestId", "hash" ])
export class LocFileDelivered extends Child {

    @PrimaryColumn({ type: "uuid", name: "id", default: () => "gen_random_uuid()" })
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

    @Column("timestamp without time zone", { name: "added_on", nullable: true })
    addedOn?: Date;

    @PrimaryColumn({ length: 255 })
    name?: string;

    @Column({ name: "value", length: 255, nullable: true })
    deprecated_value?: string;

    @Column("text", { name: "value_text", default: "" })
    value?: string;

    @Column("boolean", { default: false })
    draft?: boolean;

    @Column({ length: 255 })
    submitter?: string;

    @ManyToOne(() => LocRequestAggregateRoot, request => request.metadata)
    @JoinColumn({ name: "request_id" })
    request?: LocRequestAggregateRoot;
}

interface Submitted {
    submitter?: string;
}

@Entity("loc_link")
@Unique([ "requestId", "index" ])
export class LocLink extends Child implements HasIndex {

    @PrimaryColumn({ type: "uuid", name: "request_id" })
    requestId?: string;

    @Column({ name: "index" })
    index?: number;

    @Column("timestamp without time zone", { name: "added_on", nullable: true })
    addedOn?: Date;

    @PrimaryColumn({ type: "uuid" })
    target?: string;

    @Column("boolean", { default: false })
    draft?: boolean;

    @Column({ length: 255, nullable: true })
    nature?: string;

    @ManyToOne(() => LocRequestAggregateRoot, request => request.links)
    @JoinColumn({ name: "request_id" })
    request?: LocRequestAggregateRoot;
}

export interface FetchLocRequestsSpecification {

    readonly expectedRequesterAddress?: string;
    readonly expectedOwnerAddress?: string;
    readonly expectedStatuses?: LocRequestStatus[];
    readonly expectedLocTypes?: LocType[];
    readonly expectedIdentityLocType?: IdentityLocType;
    readonly isVerifiedThirdParty?: boolean;
}

@injectable()
export class LocRequestRepository {

    constructor() {
        this.repository = appDataSource.getRepository(LocRequestAggregateRoot);
    }

    readonly repository: Repository<LocRequestAggregateRoot>;

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
            .andWhere("hash = :hash", { hash: file.hash })
        await saveIndexedChildren({
            children: root.files!,
            entityManager,
            entityClass: LocFile,
            whereExpression,
            childrenToDelete: root._filesToDelete
        });
        if(root.files) {
            for(const file of root.files) {
                await this.saveDelivered(file);
            }
        }
    }

    private async saveDelivered(root: LocFile): Promise<void> {
        await saveChildren({
            children: root.delivered,
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
        let builder = this.repository.createQueryBuilder("request")
            .leftJoinAndSelect("request.files", "file")
            .leftJoinAndSelect("file.delivered", "delivered")
            .leftJoinAndSelect("request.metadata", "metadata_item")
            .leftJoinAndSelect("request.links", "link");

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

        if (specification.expectedIdentityLocType === "Polkadot") {
            builder.andWhere("request.requester_address IS NOT NULL")
        } else if (specification.expectedIdentityLocType === "Logion") {
            builder.andWhere("request.requester_address IS NULL")
        }

        if(specification.isVerifiedThirdParty !== undefined) {
            if(specification.isVerifiedThirdParty) {
                builder.andWhere("request.verified_third_party IS TRUE");
            } else {
                builder.andWhere("request.verified_third_party IS FALSE");
            }
        }

        builder
            .orderBy("request.voided_on", "DESC", "NULLS FIRST")
            .addOrderBy("request.closed_on", "DESC", "NULLS FIRST")
            .addOrderBy("request.loc_created_on", "DESC", "NULLS FIRST")
            .addOrderBy("request.decision_on", "DESC", "NULLS FIRST")
            .addOrderBy("request.created_on", "DESC", "NULLS FIRST");

        return builder.getMany();
    }

    async deleteDraftOrRejected(request: LocRequestAggregateRoot): Promise<void> {
        if(request.status !== "DRAFT" && request.status !== "REJECTED") {
            throw new Error("Cannot delete non-draft and non-rejected request");
        }

        await this.repository.manager.delete(LocFile, { requestId: request.id });
        await this.repository.manager.delete(LocMetadataItem, { requestId: request.id });
        await this.repository.manager.delete(LocLink, { requestId: request.id });
        await this.repository.manager.delete(LocRequestAggregateRoot, request.id);
    }

    async getVerifiedThirdPartyIdentityLoc(address: string): Promise<LocRequestAggregateRoot | undefined> {
        let identityLocs = await this.findBy({
            expectedRequesterAddress: address,
            expectedLocTypes: [ "Identity" ],
            expectedStatuses: [ "CLOSED" ],
            isVerifiedThirdParty: true,
        });
        identityLocs = identityLocs.filter(loc => loc.getVoidInfo() === null);
        if(identityLocs.length > 0) {
            return identityLocs[0];
        } else {
            return undefined;
        }
    }
}

export interface NewLocRequestParameters {
    readonly id: string;
    readonly description: LocRequestDescription;
}

export interface NewUserLocRequestParameters extends NewLocRequestParameters {
    readonly draft: boolean;
}

export interface NewSofRequestParameters extends NewLocRequestParameters, LinkDescription {
}

@injectable()
export class LocRequestFactory {

    constructor(
        private repository: LocRequestRepository,
        private sealService: PersonalInfoSealService,
    ) {
    }

    async newLOLocRequest(params: NewLocRequestParameters): Promise<LocRequestAggregateRoot> {
        return await this.newLocRequest({ ...params, draft: false }, false);
    }

    async newSofRequest(params: NewSofRequestParameters): Promise<LocRequestAggregateRoot> {
        const request = await this.newLocRequest({ ...params, draft: true });
        request.addLink(params);
        request.submit();
        return request;
    }

    async newLocRequest(params: NewUserLocRequestParameters, isUserRequest: boolean = true): Promise<LocRequestAggregateRoot> {
        const { description } = params;
        this.ensureCorrectRequester(description)
        this.ensureUserIdentityPresent(description, isUserRequest)
        const request = new LocRequestAggregateRoot();
        request.id = params.id;
        request.status = params.draft ? "DRAFT" : "REQUESTED";
        request.requesterAddress = description.requesterAddress;
        if (description.requesterIdentityLoc) {
            const identityLoc = await this.repository.findById(description.requesterIdentityLoc);
            request._requesterIdentityLoc = identityLoc ? identityLoc : undefined;
            request.requesterIdentityLocId = description.requesterIdentityLoc;
        }
        request.ownerAddress = description.ownerAddress;
        request.description = description.description;
        request.locType = description.locType;
        request.createdOn = description.createdOn;
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
        if (request.locType === 'Identity') {
            const personalInfo: PersonalInfo = { userIdentity, userPostalAddress, company }
            const seal = this.sealService.seal(personalInfo, LATEST_SEAL_VERSION);
            request.updateSealedPersonalInfo(personalInfo, seal);
        } else {
            request.updateUserIdentity(userIdentity);
            request.updateUserPostalAddress(userPostalAddress);
            request.company = company;
        }
        request.files = [];
        request.metadata = [];
        request.links = [];
        return request;
    }

    private ensureCorrectRequester(description: LocRequestDescription) {
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

    private ensureUserIdentityPresent(description: LocRequestDescription, isUserRequest: boolean) {
        if (description.locType === 'Identity' && (!description.requesterAddress || isUserRequest)) {
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
}
