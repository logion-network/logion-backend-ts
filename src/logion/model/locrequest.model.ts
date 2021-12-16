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
import { order, HasIndex } from "../lib/db/collections";
import { saveChildren, deleteIndexedChild, Child } from "./child";
import { WhereExpressionBuilder } from "typeorm/query-builder/WhereExpressionBuilder";
import { EntityManager } from "typeorm/entity-manager/EntityManager";
import { Log } from "../util/Log";

const { logger } = Log;

export type LocRequestStatus = components["schemas"]["LocRequestStatus"];
export type LocType = components["schemas"]["LocType"];

export interface LocRequestDescription {
    readonly requesterAddress: string;
    readonly ownerAddress: string;
    readonly description: string;
    readonly createdOn: string;
    readonly userIdentity: UserIdentity | undefined;
    readonly locType: LocType;
}

export interface FileDescription {
    readonly name: string;
    readonly hash: string;
    readonly oid: number;
    readonly contentType: string;
    readonly nature: string;
    readonly addedOn?: Moment;
}

export interface MetadataItemDescription {
    readonly name: string;
    readonly value: string;
    readonly addedOn?: Moment;
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
            requesterAddress: this.requesterAddress!,
            ownerAddress: this.ownerAddress!,
            description: this.description!,
            createdOn: this.createdOn!,
            userIdentity,
            locType: this.locType === 'Identity' ? this.locType : 'Transaction',
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
        file.oid = fileDescription.oid;
        file.contentType = fileDescription.contentType;
        file.draft = true;
        file.nature = fileDescription.nature;
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
            oid: file!.oid!,
            nature: file!.nature!,
            addedOn: file!.addedOn !== undefined ? moment(file!.addedOn) : undefined,
        };
    }

    getFiles(includeDraft: boolean = true): FileDescription[] {
        return order(this.files?.filter(item => includeDraft || ! item.draft), file => this.toFileDescription(file));
    }

    setLocCreatedDate(timestamp: Moment) {
        if (this.locCreatedOn) {
            logger.warn("LOC created date is already set");
        }
        this.locCreatedOn = timestamp.toISOString();
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
            addedOn: item.addedOn ? moment(item.addedOn) : undefined,
        })
    }

    getMetadataItems(includeDraft: boolean = true): MetadataItemDescription[] {
        return order(this.metadata?.filter(item => includeDraft || ! item.draft), this.toMetadataItemDescription);
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

    removeMetadataItem(name: string): void {
        this.ensureOpen();
        const removedItemIndex: number = this.metadata!.findIndex(link => link.name === name);
        if (removedItemIndex === -1) {
            throw new Error("No metadata item with given name");
        }
        const removedItem: LocMetadataItem = this.metadata![removedItemIndex];
        if (!removedItem.draft) {
            throw new Error("Only draft links can be removed");
        }
        deleteIndexedChild(removedItemIndex, this.metadata!, this._metadataToDelete)
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

    removeFile(hash: string): FileDescription {
        this.ensureOpen();
        const removedFileIndex: number = this.files!.findIndex(file => file.hash === hash);
        if(removedFileIndex === -1) {
            throw new Error("No file with given hash");
        }
        const removedFile: LocFile = this.files![removedFileIndex];
        if(!removedFile.draft) {
            throw new Error("Only draft files can be removed");
        }
        deleteIndexedChild(removedFileIndex, this.files!, this._filesToDelete)
        return this.toFileDescription(removedFile);
    }

    addLink(itemDescription: LinkDescription) {
        this.ensureOpen();
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
        return order(this.links?.filter(link => includeDraft || ! link.draft), this.toLinkDescription);
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

    removeLink(target: string): void {
        this.ensureOpen();
        const removedLinkIndex: number = this.links!.findIndex(link => link.target === target);
        if (removedLinkIndex === -1) {
            throw new Error("No link with given target");
        }
        const removedLink: LocLink = this.links![removedLinkIndex];
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

    @Column({ length: 255, name: "requester_address" })
    requesterAddress?: string;

    @Column({ length: 255, name: "owner_address" })
    ownerAddress?: string;

    @Column({ length: 255, name: "description" })
    description?: string;

    @Column({ length: 255, name: "loc_type" })
    locType?: string;

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
export class LocFile extends Child implements HasIndex {

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

    @Column("int4")
    oid?: number;

    @Column({ length: 255, name: "content_type" })
    contentType?: string;

    @Column("boolean")
    draft?: boolean;

    @Column({ length: 255, nullable: true })
    nature?: string;

    @ManyToOne(() => LocRequestAggregateRoot, request => request.files)
    @JoinColumn({ name: "request_id", referencedColumnName: "id" })
    request?: LocRequestAggregateRoot;

}

@Entity("loc_metadata_item")
@Unique(["requestId", "index"])
export class LocMetadataItem extends Child implements HasIndex {

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

    @ManyToOne(() => LocRequestAggregateRoot, request => request.metadata)
    @JoinColumn({ name: "request_id" })
    request?: LocRequestAggregateRoot;
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
        await saveChildren({
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
        await saveChildren({
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
        await saveChildren({
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

@injectable()
export class LocRequestFactory {

    public newOpenLoc(params: NewLocRequestParameters): LocRequestAggregateRoot {
        const request = this.newLocRequest(params);
        request.accept(moment())
        return request
    }

    public newLocRequest(params: NewLocRequestParameters): LocRequestAggregateRoot {
        const request = new LocRequestAggregateRoot();
        request.id = params.id;
        request.status = "REQUESTED";
        request.requesterAddress = params.description.requesterAddress;
        request.ownerAddress = params.description.ownerAddress;
        request.description = params.description.description;
        request.locType = params.description.locType;
        request.createdOn = params.description.createdOn;
        const userIdentity = params.description.userIdentity;
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
}
