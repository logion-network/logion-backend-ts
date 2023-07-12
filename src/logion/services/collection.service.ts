import { injectable } from "inversify";
import { DefaultTransactional, PolkadotService, requireDefined } from "@logion/rest-api-core";
import { ItemFile, CollectionItem, UUID } from "@logion/node-api";
import { CollectionItemAggregateRoot, CollectionRepository } from "../model/collection.model.js";

export interface GetCollectionItemParams {
    collectionLocId: string,
    itemId: string,
}

export interface GetCollectionItemFileParams extends GetCollectionItemParams {
    hash: string
}

@injectable()
export class LogionNodeCollectionService {

    constructor(
        private polkadotService: PolkadotService,
    ) {}

    async getCollectionItem(params: GetCollectionItemParams): Promise<CollectionItem | undefined> {
        const { collectionLocId, itemId } = params;
        const api = await this.polkadotService.readyApi();
        return await api.queries.getCollectionItem(
            new UUID(collectionLocId),
            itemId
        );
    }

    async getCollectionItemFile(params: GetCollectionItemFileParams): Promise<ItemFile | undefined> {
        const { hash } = params;
        const collectionItem = await this.getCollectionItem(params);
        return collectionItem?.files.find(itemFile => itemFile.hash === hash);
    }
}

export abstract class CollectionService {

    constructor(
        private collectionRepository: CollectionRepository,
    ) {}

    async addCollectionItem(item: CollectionItemAggregateRoot): Promise<void> {
        const previousItem = await this.collectionRepository.findBy(
            requireDefined(item.collectionLocId),
            requireDefined(item.itemId),
        );
        if(previousItem) {
            throw new Error("Cannot replace existing item");
        }
        await this.collectionRepository.save(item);
    }

    async cancelCollectionItem(item: CollectionItemAggregateRoot): Promise<void> {
        await this.collectionRepository.delete(item);
    }

    async update(collectionLocId: string, itemId: string, mutator: (item: CollectionItemAggregateRoot) => Promise<void>): Promise<CollectionItemAggregateRoot> {
        const item = requireDefined(await this.collectionRepository.findBy(collectionLocId, itemId));
        await mutator(item);
        await this.collectionRepository.save(item);
        return item;
    }
}

@injectable()
export class TransactionalCollectionService extends CollectionService {

    constructor(
        collectionRepository: CollectionRepository,
    ) {
        super(collectionRepository);
    }

    @DefaultTransactional()
    async addCollectionItem(item: CollectionItemAggregateRoot): Promise<void> {
        await super.addCollectionItem(item);
    }

    @DefaultTransactional()
    async cancelCollectionItem(item: CollectionItemAggregateRoot): Promise<void> {
        await super.cancelCollectionItem(item);
    }

    @DefaultTransactional()
    async update(collectionLocId: string, itemId: string, mutator: (item: CollectionItemAggregateRoot) => Promise<void>): Promise<CollectionItemAggregateRoot> {
        return super.update(collectionLocId, itemId, mutator);
    }
}

@injectable()
export class NonTransactionalCollectionService extends CollectionService {

    constructor(
        collectionRepository: CollectionRepository,
    ) {
        super(collectionRepository);
    }
}
