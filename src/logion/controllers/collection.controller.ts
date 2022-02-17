import { injectable } from "inversify";
import { Controller, ApiController, Async, HttpGet } from "dinoloop";
import { CollectionRepository, CollectionItemAggregateRoot } from "../model/collection.model";
import { components } from "./components";
import { requireDefined } from "../lib/assertions";
import { OpenAPIV3 } from "express-oas-generator";
import { addTag, setControllerTag, getPublicResponses, setPathParameters } from "./doc";
import { badRequest } from "./errors";

type CollectionItemView = components["schemas"]["CollectionItemView"];

export function fillInSpec(spec: OpenAPIV3.Document): void {
    const tagName = 'Collections';
    addTag(spec, {
        name: tagName,
        description: "Handling of Collections"
    });
    setControllerTag(spec, /^\/api\/collection.*/, tagName);

    CollectionController.getCollectionItem(spec)
}

@injectable()
@Controller('/collection')
export class CollectionController extends ApiController {

    constructor(
        private collectionRepository: CollectionRepository
    ) {
        super();
    }

    static getCollectionItem(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/collection/{collectionLocId}/{itemId}"].get!;
        operationObject.summary = "Gets the info of a published Collection Item";
        operationObject.description = "No authentication required.";
        operationObject.responses = getPublicResponses("CollectionItemView");
        setPathParameters(operationObject, {
            'collectionLocId': "The id of the collection loc",
            'itemId': "The id of the collection item"
        });
    }

    @HttpGet('/:collectionLocId/:itemId')
    @Async()
    async getCollectionItem(_body: any, collectionLocId: string, itemId: string): Promise<CollectionItemView> {
        const collectionItem = requireDefined(
            await this.collectionRepository.findBy(collectionLocId, itemId),
            () => badRequest(`Collection item ${ collectionLocId }/${ itemId } not found`));
        return this.toView(collectionItem)
    }

    private toView(collectionItem: CollectionItemAggregateRoot): CollectionItemView {
        const { collectionLocId, itemId, addedOn } = collectionItem.getDescription();
        return {
            collectionLocId,
            itemId,
            addedOn: addedOn.toISOString()
        }
    }
}
