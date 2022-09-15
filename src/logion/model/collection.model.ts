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
import moment, { Moment } from "moment";
import { injectable } from "inversify";

import { appDataSource } from "@logion/rest-api-core";

export interface CollectionItemDescription {
    readonly collectionLocId: string
    readonly itemId: string
    readonly addedOn?: Moment
    readonly files?: CollectionItemFileDescription[]
}

export interface CollectionItemFileDescription {
    readonly hash: string;
    readonly cid: string;
}

@Entity("collection_item")
export class CollectionItemAggregateRoot {

    getDescription(): CollectionItemDescription {
        return {
            collectionLocId: this.collectionLocId!,
            itemId: this.itemId!,
            addedOn: moment(this.addedOn),
            files: this.files?.map(file => file.getDescription()) || []
        }
    }

    addFile(fileDescription: CollectionItemFileDescription): CollectionItemFile {
        const { hash, cid } = fileDescription
        const file = new CollectionItemFile();
        file.collectionLocId = this.collectionLocId;
        file.itemId = this.itemId;
        file.hash = hash;
        file.cid = cid;
        file.collectionItem = this;
        this.files?.push(file);
        return file
    }

    @PrimaryColumn({ type: "uuid", name: "collection_loc_id" })
    collectionLocId?: string;

    @PrimaryColumn({ name: "item_id" })
    itemId?: string;

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
}

@Entity("collection_item_file")
export class CollectionItemFile {

    getDescription(): CollectionItemFileDescription {
        return {
            hash: this.hash!,
            cid: this.cid!,
        }
    }
    @PrimaryColumn({ type: "uuid", name: "collection_loc_id" })
    collectionLocId?: string;

    @PrimaryColumn({ name: "item_id" })
    itemId?: string;

    @PrimaryColumn({ name: "hash" })
    hash?: string;

    @Column({ length: 255 })
    cid?: string;

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

@Entity("collection_item_file_delivered")
@Index([ "collectionLocId", "itemId", "hash" ])
export class CollectionItemFileDelivered {

    @PrimaryColumn({ type: "uuid", name: "id", default: () => "gen_random_uuid()" })
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
    }

    readonly repository: Repository<CollectionItemAggregateRoot>;
    readonly fileRepository: Repository<CollectionItemFile>;
    readonly deliveredRepository: Repository<CollectionItemFileDelivered>;

    public async save(root: CollectionItemAggregateRoot): Promise<void> {
        await this.repository.save(root);
    }

    public async saveFile(file: CollectionItemFile): Promise<void> {
        await this.fileRepository.insert(file);
    }

    public async saveDelivered(file: CollectionItemFileDelivered): Promise<void> {
        await this.deliveredRepository.insert(file);
    }

    public async createIfNotExist(collectionLocId: string, itemId: string, creator: () => CollectionItemAggregateRoot): Promise<CollectionItemAggregateRoot> {

        return await appDataSource.manager.transaction("REPEATABLE READ", async entityManager => {
            try {
                const existingCollectionItem = await entityManager.findOneBy(CollectionItemAggregateRoot, {
                    collectionLocId,
                    itemId
                });
                if (existingCollectionItem) {
                    return existingCollectionItem;
                } else {
                    const newCollectionItem = creator();
                    await entityManager.insert(CollectionItemAggregateRoot, newCollectionItem);
                    return newCollectionItem;
                }
            } catch (error) {
                return Promise.reject(error)
            }
        });
    }

    public async findBy(collectionLocId: string, itemId: string): Promise<CollectionItemAggregateRoot | null> {
        return this.repository.findOneBy({ collectionLocId, itemId })
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
}

@injectable()
export class CollectionFactory {

    newItem(params: CollectionItemDescription): CollectionItemAggregateRoot {
        const { collectionLocId, itemId, addedOn } = params;
        const item = new CollectionItemAggregateRoot()
        item.collectionLocId = collectionLocId;
        item.itemId = itemId;
        item.addedOn = addedOn?.toDate();
        item.files = [];
        return item;
    }
}
