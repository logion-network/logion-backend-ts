import {
    Entity,
    PrimaryColumn,
    Column,
    Repository,
    OneToMany,
    ManyToOne,
    JoinColumn,
    Index
} from "typeorm";
import { WhereExpressionBuilder } from "typeorm/query-builder/WhereExpressionBuilder.js";
import moment, { Moment } from "moment";
import { injectable } from "inversify";

import { appDataSource, requireDefined } from "@logion/rest-api-core";
import { Child, saveChildren, saveIndexedChildren } from "./child.js";
import { HasIndex } from "../lib/db/collections.js";

export interface CollectionItemDescription {
    readonly collectionLocId: string
    readonly itemId: string
    readonly addedOn?: Moment
    readonly files?: CollectionItemFileDescription[]
    readonly description?: string
    readonly termsAndConditions?: TermsAndConditionsElementDescription[]
    readonly token?: CollectionItemTokenDescription
}

export interface CollectionItemFileDescription {
    readonly name?: string;
    readonly contentType?: string;
    readonly hash: string;
    readonly cid?: string;
}

export interface TermsAndConditionsElementDescription {
    readonly type?: string;
    readonly details?: string;
}

export interface CollectionItemTokenDescription {
    readonly type?: string;
    readonly id?: string;
}

export class CollectionItemToken {

    @Column("varchar", { length: 255, name: "token_type", nullable: true })
    type?: string | null;

    @Column("varchar", { length: 255, name: "token_id", nullable: true })
    id?: string | null;

    static from(token: CollectionItemTokenDescription | undefined): CollectionItemToken {
        const embeddable = new CollectionItemToken();
        if(token) {
            embeddable.type = token.type;
            embeddable.id = token.id;
        }
        return embeddable;
    }

    getDescription(): CollectionItemTokenDescription | undefined {
        if(this.type && this.id) {
            return {
                type: this.type,
                id: this.id,
            };
        } else {
            return undefined;
        }
    }
}

@Entity("collection_item")
export class CollectionItemAggregateRoot {

    getDescription(): CollectionItemDescription {
        return {
            collectionLocId: this.collectionLocId!,
            itemId: this.itemId!,
            addedOn: this.addedOn ? moment(this.addedOn) : undefined,
            description: this.description,
            token: this.token ? this.token.getDescription() : undefined,
            files: this.files?.map(file => file.getDescription()) || [],
            termsAndConditions: this.termsAndConditions?.map(element => element.getDescription()) || [],
        }
    }

    setFileCid(fileDescription: { hash: string, cid: string }) {
        const { hash, cid } = fileDescription;
        const file = this.file(hash);
        if(!file) {
            throw new Error(`No file with hash ${ hash }`);
        }
        file.setCid(cid);
    }

    confirm(addedOn: Moment) {
        if(this.addedOn) {
            throw new Error("Already confirmed");
        }
        this.addedOn = addedOn.toDate();
    }

    @PrimaryColumn({ type: "uuid", name: "collection_loc_id" })
    collectionLocId?: string;

    @PrimaryColumn({ name: "item_id" })
    itemId?: string;

    @Column({ length: 4096, name: "description", nullable: true })
    description?: string;

    @Column(() => CollectionItemToken, { prefix: "" })
    token?: CollectionItemToken;

    @OneToMany(() => CollectionItemFile, file => file.collectionItem, {
        eager: true,
        cascade: false,
        persistence: false
    })
    files?: CollectionItemFile[];

    @Column("timestamp without time zone", { name: "added_on", nullable: true })
    addedOn?: Date;

    hasFile(hash: string): boolean {
        return this.file(hash) !== undefined;
    }

    file(hash: string): CollectionItemFile | undefined {
        return this.files!.find(file => file.hash === hash)
    }

    getFile(hash: string): CollectionItemFile {
        return this.file(hash)!;
    }

    @OneToMany(() => TermsAndConditionsElement, element => element.collectionItem, {
        eager: true,
        cascade: false,
        persistence: false
    })
    termsAndConditions?: TermsAndConditionsElement[];
}

@Entity("collection_item_file")
export class CollectionItemFile extends Child {

    static from(description: CollectionItemFileDescription, root?: CollectionItemAggregateRoot): CollectionItemFile {
        if(!description.name || !description.contentType) {
            throw new Error("No name nor content type provided");
        }
        const file = new CollectionItemFile();
        file.name = description.name;
        file.contentType = description.contentType;
        file.hash = description.hash;

        if(root) {
            file.collectionLocId = root.collectionLocId;
            file.itemId = root.itemId;
            file.collectionItem = root;
            file._toAdd = true;
        }

        return file;
    }

    getDescription(): CollectionItemFileDescription {
        return {
            hash: this.hash!,
            name: this.name,
            contentType: this.contentType,
            cid: this.cid || undefined,
        }
    }

    @PrimaryColumn({ type: "uuid", name: "collection_loc_id" })
    collectionLocId?: string;

    @PrimaryColumn({ name: "item_id" })
    itemId?: string;

    @PrimaryColumn({ name: "hash" })
    hash?: string;

    @Column({ length: 255, name: "name", nullable: true })
    name?: string;

    @Column({ length: 255, name: "content_type", nullable: true })
    contentType?: string;

    setCid(cid: string) {
        if(this.cid) {
            throw new Error("File has already a CID");
        }
        this.cid = cid;
        this._toUpdate = true;
    }

    @Column("varchar", { length: 255, nullable: true })
    cid?: string | null;

    @ManyToOne(() => CollectionItemAggregateRoot, request => request.files)
    @JoinColumn([
        { name: "collection_loc_id", referencedColumnName: "collectionLocId" },
        { name: "item_id", referencedColumnName: "itemId" },
    ])
    collectionItem?: CollectionItemAggregateRoot;

    addDeliveredFile(params: {
        deliveredFileHash: string,
        generatedOn: Moment,
        owner: string,
    }): CollectionItemFileDelivered {
        const { deliveredFileHash, generatedOn, owner } = params;
        const deliveredFile = new CollectionItemFileDelivered();

        deliveredFile.collectionLocId = this.collectionLocId;
        deliveredFile.itemId = this.itemId;
        deliveredFile.hash = this.hash;

        deliveredFile.deliveredFileHash = deliveredFileHash;
        deliveredFile.generatedOn = generatedOn.toDate();
        deliveredFile.owner = owner;

        deliveredFile.collectionItemFile = this;
        deliveredFile._toAdd = true;
        this.delivered?.push(deliveredFile);
        return deliveredFile;
    }

    @OneToMany(() => CollectionItemFileDelivered, deliveredFile => deliveredFile.collectionItemFile, {
        eager: true,
        cascade: false,
        persistence: false
    })
    delivered?: CollectionItemFileDelivered[];
}

@Entity("collection_item_tc_element")
export class TermsAndConditionsElement extends Child implements HasIndex {

    static from(description: TermsAndConditionsElementDescription, index: number, root?: CollectionItemAggregateRoot): TermsAndConditionsElement {
        const element = new TermsAndConditionsElement();
        element.index = index;
        element.type = description.type;
        element.details = description.details;

        if(root) {
            element.collectionLocId = root.collectionLocId;
            element.itemId = root.itemId;
            element.collectionItem = root;
            element._toAdd = true;
        }

        return element;
    }

    getDescription(): TermsAndConditionsElementDescription {
        return {
            type: this.type,
            details: this.details,
        }
    }

    @PrimaryColumn({ type: "uuid", name: "collection_loc_id" })
    collectionLocId?: string;

    @PrimaryColumn({ name: "item_id" })
    itemId?: string;

    @PrimaryColumn({ name: "element_index" })
    index?: number;

    @Column({ name: "type", length: 255 })
    type?: string;

    @Column({ name: "details", length: 255 })
    details?: string;

    @ManyToOne(() => CollectionItemAggregateRoot, request => request.termsAndConditions)
    @JoinColumn([
        { name: "collection_loc_id", referencedColumnName: "collectionLocId" },
        { name: "item_id", referencedColumnName: "itemId" },
    ])
    collectionItem?: CollectionItemAggregateRoot;
}

@Entity("collection_item_file_delivered")
@Index([ "collectionLocId", "itemId", "hash" ])
export class CollectionItemFileDelivered extends Child {

    @PrimaryColumn({ type: "uuid", name: "id", default: () => "gen_random_uuid()", generated: "uuid" })
    id?: string;

    @Column({ type: "uuid", name: "collection_loc_id" })
    collectionLocId?: string;

    @Column({ name: "item_id" })
    itemId?: string;

    @Column({ name: "hash" })
    hash?: string;

    @Column({ name: "delivered_file_hash", length: 255 })
    deliveredFileHash?: string;

    @Column("timestamp without time zone", { name: "generated_on", nullable: true })
    generatedOn?: Date;

    @Column({ length: 255 })
    owner?: string;

    @ManyToOne(() => CollectionItemFile, file => file.delivered)
    @JoinColumn([
        { name: "collection_loc_id", referencedColumnName: "collectionLocId" },
        { name: "item_id", referencedColumnName: "itemId" },
        { name: "hash", referencedColumnName: "hash" },
    ])
    collectionItemFile?: CollectionItemFile;
}

@injectable()
export class CollectionRepository {

    constructor() {
        this.repository = appDataSource.getRepository(CollectionItemAggregateRoot);
        this.fileRepository = appDataSource.getRepository(CollectionItemFile);
        this.deliveredRepository = appDataSource.getRepository(CollectionItemFileDelivered);
        this.termsRepository = appDataSource.getRepository(TermsAndConditionsElement);
    }

    readonly repository: Repository<CollectionItemAggregateRoot>;
    readonly fileRepository: Repository<CollectionItemFile>;
    readonly deliveredRepository: Repository<CollectionItemFileDelivered>;
    readonly termsRepository: Repository<TermsAndConditionsElement>;

    public async save(root: CollectionItemAggregateRoot): Promise<void> {
        await this.repository.save(root);
        await this.saveFiles(root);
        await this.saveTermsAndConditions(root);
    }

    private async saveFiles(root: CollectionItemAggregateRoot): Promise<void> {
        if(root.files) {
            const whereExpression: <E extends WhereExpressionBuilder>(sql: E, file: CollectionItemFile) => E = (sql, _file) => sql
                .where("collection_loc_id = :locId", { locId: root.collectionLocId })
                .andWhere("item_id = :itemId", { itemId: root.itemId });
            await saveChildren({
                children: root.files,
                entityManager: this.repository.manager,
                entityClass: CollectionItemFile,
                whereExpression,
                updateValuesExtractor: file => {
                    const values = { ...file };
                    delete values.delivered;
                    return values;
                }
            });
            for(const file of root.files) {
                await this.saveDelivered(file);
            }
        }
    }

    private async saveDelivered(root: CollectionItemFile): Promise<void> {
        await saveChildren({
            children: root.delivered,
            entityManager: this.repository.manager,
            entityClass: CollectionItemFileDelivered,
        });
    }

    private async saveTermsAndConditions(root: CollectionItemAggregateRoot): Promise<void> {
        if(root.termsAndConditions) {
            await saveIndexedChildren({
                children: root.termsAndConditions,
                entityManager: this.repository.manager,
                entityClass: TermsAndConditionsElement,
            });
        }
    }

    public async findBy(collectionLocId: string, itemId: string): Promise<CollectionItemAggregateRoot | null> {
        return this.repository.findOneBy({ collectionLocId, itemId })
    }

    public async findAllBy(collectionLocId: string): Promise<CollectionItemAggregateRoot[]> {
        const builder = this.repository.createQueryBuilder("item")
            .leftJoinAndSelect("item.files", "file")
            .leftJoinAndSelect("item.termsAndConditions", "tc");
        builder.where("item.collection_loc_id = :collectionLocId", { collectionLocId });
        builder.orderBy("item.added_on", "DESC");
        return builder.getMany();
    }

    public async findLatestDelivery(query: { collectionLocId: string, itemId: string, fileHash: string }): Promise<CollectionItemFileDelivered | undefined> {
        const { collectionLocId, itemId, fileHash } = query;
        const deliveries = await this.findLatestDeliveries({ collectionLocId, itemId, fileHash, limit: 1 });
        const deliveriesList = deliveries[fileHash];
        if(deliveriesList) {
            return deliveriesList[0];
        } else {
            return undefined;
        }
    }

    public async findLatestDeliveries(query: { collectionLocId: string, itemId: string, fileHash?: string, limit?: number }): Promise<Record<string, CollectionItemFileDelivered[]>> {
        const { collectionLocId, itemId, fileHash, limit } = query;
        let builder = this.deliveredRepository.createQueryBuilder("delivery");
        builder.where("delivery.collection_loc_id = :collectionLocId", { collectionLocId });
        builder.andWhere("delivery.item_id = :itemId", { itemId });
        if(fileHash) {
            builder.andWhere("delivery.hash = :fileHash", { fileHash });
        }
        builder.orderBy("delivery.generated_on", "DESC");
        if(limit) {
            builder.limit(limit);
        }
        const deliveriesList = await builder.getMany();
        const deliveries: Record<string, CollectionItemFileDelivered[]> = {};
        for(const delivery of deliveriesList) {
            const hash = delivery.hash!;
            deliveries[hash] ||= [];
            const fileDeliveries = deliveries[hash];
            fileDeliveries.push(delivery);
        }
        return deliveries;
    }

    async delete(item: CollectionItemAggregateRoot): Promise<void> {
        if(item.addedOn) {
            throw new Error("Cannot delete already published item");
        }
        const criteria = {
            collectionLocId: requireDefined(item.collectionLocId),
            itemId: requireDefined(item.itemId),
        };
        await this.termsRepository.delete(criteria);
        await this.deliveredRepository.delete(criteria); // There should be none
        await this.fileRepository.delete(criteria);
        await this.repository.delete(criteria);
    }
}

@injectable()
export class CollectionFactory {

    newItem(params: CollectionItemDescription): CollectionItemAggregateRoot {
        const { collectionLocId, itemId } = params;
        const item = new CollectionItemAggregateRoot()
        item.collectionLocId = collectionLocId;
        item.itemId = itemId;
        item.description = params.description;
        item.token = CollectionItemToken.from(params.token);
        item.files = params.files?.map(file => CollectionItemFile.from(file, item)) || [];
        item.termsAndConditions = params.termsAndConditions?.map((element, index) => TermsAndConditionsElement.from(element, index, item)) || [];
        return item;
    }
}
