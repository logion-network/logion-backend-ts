import { Entity, PrimaryColumn, Column, getRepository, Repository } from "typeorm";
import moment, { Moment } from "moment";
import { injectable } from "inversify";

export interface CollectionItemDescription {
    readonly collectionLocId: string
    readonly itemId: string
    readonly addedOn: Moment
}

@Entity("collection_item")
export class CollectionItemAggregateRoot {

    getDescription(): CollectionItemDescription {
        return {
            collectionLocId: this.collectionLocId!,
            itemId: this.itemId!,
            addedOn: moment(this.addedOn)
        }
    }

    @PrimaryColumn({ type: "uuid", name: "collection_loc_id" })
    collectionLocId?: string;

    @PrimaryColumn({ name: "item_id" })
    itemId?: string;

    @Column("timestamp without time zone", { name: "added_on" })
    addedOn?: Date;

}

@injectable()
export class CollectionRepository {

    constructor() {
        this.repository = getRepository(CollectionItemAggregateRoot);
    }

    readonly repository: Repository<CollectionItemAggregateRoot>;

    public async save(root: CollectionItemAggregateRoot): Promise<void> {
        await this.repository.save(root);
    }

    public async findBy(collectionLocId: string, itemId: string): Promise<CollectionItemAggregateRoot | undefined> {
        return this.repository.findOne({ collectionLocId, itemId })
    }
}

@injectable()
export class CollectionFactory {

    newItem(params: CollectionItemDescription): CollectionItemAggregateRoot {
        const { collectionLocId, itemId, addedOn } = params;
        const item = new CollectionItemAggregateRoot()
        item.collectionLocId = collectionLocId;
        item.itemId = itemId;
        item.addedOn = addedOn.toDate();
        return item;
    }
}
