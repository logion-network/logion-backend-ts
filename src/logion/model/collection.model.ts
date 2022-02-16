import { Entity, PrimaryColumn, Column, getRepository, Repository } from "typeorm";
import { Moment } from "moment";
import { injectable } from "inversify";

export interface CollectionItemDescription {
    readonly itemId: string
    readonly addedOn: Moment
}

@Entity("collection_item")
export class CollectionItemAggregateRoot {

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
}

export interface NewItemParameters {
    collectionLocId: string,
    description: CollectionItemDescription
}

@injectable()
export class CollectionFactory {

    newItem(params: NewItemParameters): CollectionItemAggregateRoot {
        const { collectionLocId, description } = params;
        const item = new CollectionItemAggregateRoot()
        item.collectionLocId = collectionLocId;
        item.itemId = description.itemId;
        item.addedOn = description.addedOn.toDate();
        return item;
    }
}
