import {
    Entity,
    PrimaryColumn,
    Column,
    Repository,
    OneToMany,
    ManyToOne,
    JoinColumn,
} from "typeorm";
import moment, { Moment } from "moment";
import { injectable } from "inversify";

import { getDataSource, getManager } from "../orm";

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

    getFile(hash: string): CollectionItemFileDescription {
        return this.file(hash)!.getDescription();
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

}

@injectable()
export class CollectionRepository {

    constructor() {
        this.repository = getDataSource().getRepository(CollectionItemAggregateRoot);
        this.fileRepository = getDataSource().getRepository(CollectionItemFile);
    }

    readonly repository: Repository<CollectionItemAggregateRoot>;
    readonly fileRepository: Repository<CollectionItemFile>;

    public async save(root: CollectionItemAggregateRoot): Promise<void> {
        await this.repository.save(root);
    }

    public async saveFile(file: CollectionItemFile): Promise<void> {
        await this.fileRepository.insert(file)
    }

    public async createIfNotExist(collectionLocId: string, itemId: string, creator: () => CollectionItemAggregateRoot): Promise<CollectionItemAggregateRoot> {

        return await getManager().transaction("REPEATABLE READ", async entityManager => {
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

    public async findBy(collectionLocId: string, itemId: string): Promise<CollectionItemAggregateRoot | undefined> {
        const result = await this.repository.findOneBy({ collectionLocId, itemId });
        if(result === null) {
            return undefined;
        } else {
            return result;
        }
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
