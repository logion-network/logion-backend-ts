import { injectable } from "inversify";
import { DefaultTransactional, PolkadotService, requireDefined } from "@logion/rest-api-core";
import { ItemFile, CollectionItem } from "@logion/node-api/dist/Types";
import { getCollectionItem } from "@logion/node-api/dist/LogionLoc.js";
import { UUID } from "@logion/node-api/dist/UUID.js";
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
        return await getCollectionItem({
            api,
            locId: new UUID(collectionLocId),
            itemId
        });
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

    async createIfNotExist(collectionLocId: string, itemId: string, creator: () => CollectionItemAggregateRoot): Promise<CollectionItemAggregateRoot> {
        return await this.collectionRepository.createIfNotExist(collectionLocId, itemId, creator);
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
    async createIfNotExist(collectionLocId: string, itemId: string, creator: () => CollectionItemAggregateRoot): Promise<CollectionItemAggregateRoot> {
        return super.createIfNotExist(collectionLocId, itemId, creator);
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
