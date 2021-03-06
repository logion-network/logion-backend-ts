import {
    Entity,
    PrimaryColumn,
    Column,
    getRepository,
    Repository,
    ManyToOne,
    JoinColumn,
    OneToMany,
    Unique,
    getManager
} from "typeorm";
import { injectable } from "inversify";
import { components } from "../controllers/components";
import moment, { Moment } from "moment";
import { EmbeddableUserIdentity, UserIdentity } from "./useridentity";
import { orderAndMap, HasIndex } from "../lib/db/collections";
import { deleteIndexedChild, Child, saveIndexedChildren } from "./child";
import { WhereExpressionBuilder } from "typeorm/query-builder/WhereExpressionBuilder";
import { EntityManager } from "typeorm/entity-manager/EntityManager";
import { Log } from "../util/Log";

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
    readonly locType: LocType;
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

@Entity("loc_request")
export class LocRequestAggregateRoot {

    reject(reason: string, rejectedOn: Moment): void {
        if(this.status != 'REQUESTED') {
            throw new Error("Cannot reject already decided request");
        }

        this.status = 'REJECTED';
        this.rejectReason = reason;
        this.decisionOn = rejectedOn.toISOString();
    }

    accept(decisionOn: Moment): void {
        if(this.status != 'REQUESTED') {
            throw new Error("Cannot accept already decided request");
        }

        this.status = 'OPEN';
        this.decisionOn = decisionOn.toISOString();
    }

    getDescription(): LocRequestDescription {
        const userIdentity = this.userIdentity &&
            (this.userIdentity.firstName || this.userIdentity.lastName || this.userIdentity.email || this.userIdentity.phoneNumber) ?
            {
                firstName: this.userIdentity.firstName || "",
                lastName: this.userIdentity.lastName || "",
                email: this.userIdentity.email || "",
                phoneNumber: this.userIdentity.phoneNumber || "",
            } : undefined;
        return {
            requesterAddress: this.requesterAddress,
            requesterIdentityLoc: this.requesterIdentityLocId,
            ownerAddress: this.ownerAddress!,
            description: this.description!,
            createdOn: this.createdOn!,
            userIdentity,
            locType: this.locType!,
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
        this.ensureOpen();
        if(this.hasFile(fileDescription.hash)) {
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
        file._toAdd = true;
        this.files!.push(file);
    }

    confirmFile(hash: string) {
        const file = this.file(hash)!;
        file.draft = false;
        file._toUpdate = true;
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

    hasFile(hash: string): boolean {
        return this.file(hash) !== undefined;
    }

    file(hash: string): LocFile | undefined {
        return this.files!.find(file => file.hash === hash)
    }

    getFile(hash: string): FileDescription {
        return this.toFileDescription(this.file(hash)!);
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
        };
    }

    getFiles(includeDraft: boolean = true): FileDescription[] {
        return orderAndMap(this.files?.filter(item => includeDraft || ! item.draft), file => this.toFileDescription(file));
    }

    setLocCreatedDate(timestamp: Moment) {
        if (this.locCreatedOn) {
            logger.warn("LOC created date is already set");
        }
        this.locCreatedOn = timestamp.toISOString();
        if(this.status === "REQUESTED") {
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
        this.ensureOpen();
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

    getMetadataItems(includeDraft: boolean = true): MetadataItemDescription[] {
        return orderAndMap(this.metadata?.filter(item => includeDraft || ! item.draft), this.toMetadataItemDescription);
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
        this.ensureOpen();
        const removedItemIndex: number = this.metadata!.findIndex(link => link.name === name);
        if (removedItemIndex === -1) {
            throw new Error("No metadata item with given name");
        }
        const removedItem: LocMetadataItem = this.metadata![removedItemIndex];
        if(!this.canRemove(removerAddress, removedItem)) {
            throw new Error("Item removal not allowed");
        }
        if (!removedItem.draft) {
            throw new Error("Only draft links can be removed");
        }
        deleteIndexedChild(removedItemIndex, this.metadata!, this._metadataToDelete)
    }

    private canRemove(address: string, item: Submitted | LocLink): boolean {
        if(item instanceof LocLink) {
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

    hasMetadataItem(name: string):boolean {
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
        this.ensureOpen();
        const removedFileIndex: number = this.files!.findIndex(file => file.hash === hash);
        if(removedFileIndex === -1) {
            throw new Error("No file with given hash");
        }
        const removedFile: LocFile = this.files![removedFileIndex];
        if(!this.canRemove(removerAddress, removedFile)) {
            throw new Error("Item removal not allowed");
        }
        if(!removedFile.draft) {
            throw new Error("Only draft files can be removed");
        }
        deleteIndexedChild(removedFileIndex, this.files!, this._filesToDelete)
        return this.toFileDescription(removedFile);
    }

    addLink(itemDescription: LinkDescription, ensureOpen: boolean = true) {
        if (ensureOpen) {
            this.ensureOpen();
        }
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

    getLinks(includeDraft: boolean = true): LinkDescription[] {
        return orderAndMap(this.links?.filter(link => includeDraft || ! link.draft), this.toLinkDescription);
    }

    setLinkAddedOn(target:string, addedOn: Moment) {
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
        this.ensureOpen();
        const removedLinkIndex: number = this.links!.findIndex(link => link.target === target);
        if (removedLinkIndex === -1) {
            throw new Error("No link with given target");
        }
        const removedLink: LocLink = this.links![removedLinkIndex];
        if(!this.canRemove(removerAddress, removedLink)) {
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

    hasLink(target: string):boolean {
        return this.link(target) !== undefined;
    }

    link(target: string): LocLink | undefined {
        return this.links!.find(link => link.target === target)
    }

    preVoid(reason: string) {
        if(this.voidInfo !== undefined && this.voidInfo.reason !== null && this.voidInfo.reason !== undefined) {
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
        if(this.voidInfo !== undefined && this.voidInfo.reason !== null) {
            return {
                reason: this.voidInfo.reason || "",
                voidedOn: this.voidInfo.voidedOn ? moment(this.voidInfo.voidedOn) : null
            };
        } else {
            return null;
        }
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

    @OneToMany(() => LocFile, file => file.request, {
        eager: true,
        cascade: false,
        persistence: false })
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

    _filesToDelete: LocFile[] = [];
    _linksToDelete: LocLink[] = [];
    _metadataToDelete: LocMetadataItem[] = [];
}

@Entity("loc_request_file")
@Unique(["requestId", "index"])
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
    request?: LocRequestAggregateRoot;

}

@Entity("loc_metadata_item")
@Unique(["requestId", "index"])
export class LocMetadataItem extends Child implements HasIndex, Submitted {

    @PrimaryColumn({ type: "uuid", name: "request_id" })
    requestId?: string;

    @Column({ name: "index" })
    index?: number;

    @Column("timestamp without time zone", { name: "added_on", nullable: true })
    addedOn?: Date;

    @PrimaryColumn({ length: 255 })
    name?: string;

    @Column({ name: "value",  length: 255, nullable: true})
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
@Unique(["requestId", "index"])
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
}

@injectable()
export class LocRequestRepository {

    constructor() {
        this.repository = getRepository(LocRequestAggregateRoot);
    }

    readonly repository: Repository<LocRequestAggregateRoot>;

    public findById(id: string): Promise<LocRequestAggregateRoot | undefined> {
        return this.repository.findOne(id);
    }

    public async save(root: LocRequestAggregateRoot): Promise<void> {

        return await getManager().transaction(async entityManager => {
            try {
                await entityManager.save(root);
                await this.saveFiles(entityManager, root)
                await this.saveMetadata(entityManager, root)
                await this.saveLinks(entityManager, root)
            } catch (error) {
                return Promise.reject(error)
            }
        })
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
        })
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
        let builder = this.repository.createQueryBuilder("request");

        if (specification.expectedRequesterAddress) {
            builder.where("request.requester_address = :expectedRequesterAddress",
                { expectedRequesterAddress: specification.expectedRequesterAddress });
        } else if (specification.expectedOwnerAddress) {
            builder.where("request.owner_address = :expectedOwnerAddress",
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

        if (specification.expectedStatuses &&
            (specification.expectedStatuses.includes("OPEN") || specification.expectedStatuses.includes("CLOSED"))) {
            builder.orderBy("request.loc_created_on", "DESC")
        } else {
            builder.orderBy("request.created_on", "DESC")
        }
        return builder.getMany();
    }
}

export interface NewLocRequestParameters {
    readonly id: string;
    readonly description: LocRequestDescription;
}

export interface NewSofRequestParameters extends NewLocRequestParameters, LinkDescription {
}

@injectable()
export class LocRequestFactory {

    constructor(
        private repository: LocRequestRepository
    ) {}

    async newOpenLoc(params: NewLocRequestParameters): Promise<LocRequestAggregateRoot> {
        const request = await this.newLocRequest(params);
        request.accept(moment())
        return request;
    }

    async newSofRequest(params: NewSofRequestParameters): Promise<LocRequestAggregateRoot> {
        const request = await this.newLocRequest(params);
        request.addLink(params, false)
        return request;
    }

    async newLocRequest(params: NewLocRequestParameters): Promise<LocRequestAggregateRoot> {
        const { description } = params;
        this.ensureCorrectRequester(description)
        this.ensureUserIdentityPresent(description)
        const request = new LocRequestAggregateRoot();
        request.id = params.id;
        request.status = "REQUESTED";
        request.requesterAddress = description.requesterAddress;
        if(description.requesterIdentityLoc) {
            request._requesterIdentityLoc = await this.repository.findById(description.requesterIdentityLoc);
            request.requesterIdentityLocId = description.requesterIdentityLoc;
        }
        request.ownerAddress = description.ownerAddress;
        request.description = description.description;
        request.locType = description.locType;
        request.createdOn = description.createdOn;
        const userIdentity = description.userIdentity;
        if (userIdentity !== undefined) {
            request.userIdentity = new EmbeddableUserIdentity();
            request.userIdentity.firstName = userIdentity.firstName;
            request.userIdentity.lastName = userIdentity.lastName;
            request.userIdentity.email = userIdentity.email;
            request.userIdentity.phoneNumber = userIdentity.phoneNumber;
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

    private ensureUserIdentityPresent(description: LocRequestDescription) {
        if (description.locType === 'Identity' && !description.requesterAddress) {
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
