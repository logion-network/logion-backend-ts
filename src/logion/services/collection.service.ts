import { injectable } from "inversify";
import { PolkadotService } from "@logion/rest-api-core";
import { ItemFile, CollectionItem } from "@logion/node-api/dist/Types";
import { getCollectionItem } from "@logion/node-api/dist/LogionLoc";
import { UUID } from "@logion/node-api/dist/UUID";

export interface GetCollectionItemParams {
    collectionLocId: string,
    itemId: string,
}

export interface GetCollectionItemFileParams extends GetCollectionItemParams {
    hash: string
}

@injectable()
export class CollectionService {

    constructor(
        private polkadotService: PolkadotService
    ) {
    }

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
