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
import { order } from "../lib/db/collections";
import { Child, saveChildren } from "./child";
import { WhereExpressionBuilder } from "typeorm/query-builder/WhereExpressionBuilder";
import { EntityManager } from "typeorm/entity-manager/EntityManager";

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
    readonly addedOn?: Moment;
}

export interface MetadataItemDescription {
    readonly name: string;
    readonly value: string;
    readonly addedOn: Moment;
}

export interface LinkDescription {
    readonly target: string;
    readonly addedOn: Moment;
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
        if(this.isFileAlreadyPresent(fileDescription.hash)) {
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
        file._toAdd = true;
        this.files!.push(file);
    }

    isFileAlreadyPresent(hash: string): boolean {
        return this.files!.find(file => file.hash === hash) !== undefined;
    }

    confirmFile(hash: string) {
        const file = this.files!.find(file => file.hash === hash);
        file!.draft = false;
    }

    private ensureOpen() {
        if(this.status !== "OPEN") {
            throw new Error("LOC is not open");
        }
    }

    hasFile(hash: string): boolean {
        return this.files!.find(file => file.hash === hash) !== undefined;
    }

    getFile(hash: string): FileDescription {
        const file = this.files!.find(file => file.hash === hash);
        return this.toFileDescription(file!);
    }

    private toFileDescription(file: LocFile): FileDescription {
        return {
            name: file!.name!,
            contentType: file!.contentType!,
            hash: file!.hash!,
            oid: file!.oid!,
            addedOn: file!.addedOn !== undefined ? moment(file!.addedOn) : undefined,
        };
    }

    getFiles(): FileDescription[] {
        return order(this.files, file => this.toFileDescription(file));
    }

    setLocCreatedDate(timestamp: Moment) {
        if(this.locCreatedOn !== undefined && this.locCreatedOn !== null) {
            throw new Error("LOC created date is already set");
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
        if(this.closedOn !== undefined && this.closedOn !== null) {
            throw new Error("LOC is already closed");
        }
        this.closedOn = timestamp.toISOString();
        this.status = 'CLOSED';
    }

    addMetadataItem(itemDescription: MetadataItemDescription) {
        this.ensureOpen();
        const item = new LocMetadataItem();
        item.request = this;
        item.requestId = this.id;
        item.index = this.metadata!.length;
        item.name = itemDescription.name;
        item.value = itemDescription.value;
        item.addedOn = itemDescription.addedOn.toDate();
        item._toAdd = true;
        this.metadata!.push(item);
    }

    getMetadataItems(): MetadataItemDescription[] {
        return order(this.metadata, item => ({
            name: item.name!,
            value: item.value!,
            addedOn: moment(item.addedOn!),
        }));
    }

    setFileAddedOn(hash: string, addedOn: Moment) {
        const file = this.files!.find(file => file.hash === hash);
        if(file === undefined) {
            throw new Error(`File with hash ${hash} not found`);
        }
        if(file!.addedOn !== undefined && file!.addedOn !== null) {
            throw new Error("File added on date is already set");
        }
        file!.addedOn = addedOn.toDate();
        file!.draft = false;
        file!._toUpdate = true;
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
        this._filesToDelete.push(removedFile);
        this.files!.splice(removedFileIndex, 1);
        this.reindexFiles(removedFileIndex!);
        return this.toFileDescription(removedFile);
    }

    private reindexFiles(removedFileIndex: number) {
        for(let i = removedFileIndex; i < this.files!.length; ++i) {
            const file = this.files![i];
            file.index = file.index! - 1;
            file._toUpdate = true;
        }
    }

    addLink(itemDescription: LinkDescription) {
        this.ensureOpen();
        const item = new LocLink();
        item.request = this;
        item.requestId = this.id;
        item.index = this.links!.length;
        item.target = itemDescription.target;
        item.addedOn = itemDescription.addedOn.toDate();
        item._toAdd = true;
        this.links!.push(item);
    }

    getLinks(): LinkDescription[] {
        return order(this.links, item => ({
            target: item.target!,
            addedOn: moment(item.addedOn!),
        }));
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

    _filesToDelete: LocFile[] = [];
}

@Entity("loc_request_file")
@Unique(["requestId", "index"])
export class LocFile extends Child {

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

    @ManyToOne(() => LocRequestAggregateRoot, request => request.files)
    @JoinColumn({ name: "request_id", referencedColumnName: "id" })
    request?: LocRequestAggregateRoot;

}

@Entity("loc_metadata_item")
export class LocMetadataItem extends Child {

    @PrimaryColumn({ type: "uuid", name: "request_id" })
    requestId?: string;

    @PrimaryColumn({ name: "index" })
    index?: number;

    @Column("timestamp without time zone", { name: "added_on", nullable: true })
    addedOn?: Date;

    @Column({ length: 255 })
    name?: string;

    @Column({ length: 255 })
    value?: string;

    @ManyToOne(() => LocRequestAggregateRoot, request => request.metadata)
    @JoinColumn({ name: "request_id" })
    request?: LocRequestAggregateRoot;
}

@Entity("loc_link")
export class LocLink extends Child {

    @PrimaryColumn({ type: "uuid", name: "request_id" })
    requestId?: string;

    @PrimaryColumn({ name: "index" })
    index?: number;

    @Column("timestamp without time zone", { name: "added_on" })
    addedOn?: Date;

    @Column({ type: "uuid" })
    target?: string;

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
        await saveChildren({
            children: root.metadata!,
            entityManager,
            entityClass: LocMetadataItem
        })
    }

    private async saveLinks(entityManager: EntityManager, root: LocRequestAggregateRoot): Promise<void> {
        await saveChildren({
            children: root.links!,
            entityManager,
            entityClass: LocLink
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
