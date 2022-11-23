import { AuthenticatedUser } from "@logion/authenticator";
import { injectable } from "inversify";
import { Controller, ApiController, Async, HttpGet, HttpPost, SendsResponse } from "dinoloop";
import { CollectionRepository, CollectionFactory, CollectionItemDescription, CollectionItemAggregateRoot, CollectionItemFileDelivered } from "../model/collection.model";
import { components } from "./components";
import { OpenAPIV3 } from "express-oas-generator";
import moment from "moment";
import { LocRequestRepository } from "../model/locrequest.model";
import { getUploadedFile } from "./fileupload";
import { sha256File } from "../lib/crypto/hashing";
import { FileStorageService } from "../services/file.storage.service";
import {
    requireDefined,
    badRequest,
    forbidden,
    addTag,
    setControllerTag,
    getPublicResponses,
    setPathParameters,
    getDefaultResponsesWithAnyBody,
    AuthenticationService,
    getRequestBody,
    getDefaultResponsesNoContent,
} from "@logion/rest-api-core";
import { CollectionService, GetCollectionItemFileParams, LogionNodeCollectionService } from "../services/collection.service";
import { CollectionItem, ItemFile } from "@logion/node-api/dist/Types";
import os from "os";
import path from "path";
import { OwnershipCheckService } from "../services/ownershipcheck.service";
import { RestrictedDeliveryService } from "../services/restricteddelivery.service";
import { downloadAndClean } from "../lib/http";

type CollectionItemView = components["schemas"]["CollectionItemView"];
type CollectionItemsView = components["schemas"]["CollectionItemsView"];
type CheckLatestDeliveryResponse = components["schemas"]["CheckLatestDeliveryResponse"];
type ItemDeliveriesResponse = components["schemas"]["ItemDeliveriesResponse"];
type FileUploadData = components["schemas"]["FileUploadData"];

export function fillInSpec(spec: OpenAPIV3.Document): void {
    const tagName = 'Collections';
    addTag(spec, {
        name: tagName,
        description: "Handling of Collections"
    });
    setControllerTag(spec, /^\/api\/collection.*/, tagName);

    CollectionController.getCollectionItems(spec)
    CollectionController.getCollectionItem(spec)
    CollectionController.addFile(spec)
    CollectionController.downloadFile(spec)
    CollectionController.canDownloadFile(spec)
    CollectionController.getLatestDeliveries(spec)
    CollectionController.getAllDeliveries(spec)
}

@injectable()
@Controller('/collection')
export class CollectionController extends ApiController {

    constructor(
        private collectionRepository: CollectionRepository,
        private locRequestRepository: LocRequestRepository,
        private authenticationService: AuthenticationService,
        private collectionFactory: CollectionFactory,
        private fileStorageService: FileStorageService,
        private logionNodeCollectionService: LogionNodeCollectionService,
        private ownershipCheckService: OwnershipCheckService,
        private restrictedDeliveryService: RestrictedDeliveryService,
        private collectionService: CollectionService,
    ) {
        super();
    }

    static getCollectionItems(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/collection/{collectionLocId}"].get!;
        operationObject.summary = "Gets the info of all published Collection Items in a collection";
        operationObject.description = "Must be authenticated as the owner or requested of the collection.";
        operationObject.responses = getPublicResponses("CollectionItemsView");
        setPathParameters(operationObject, {
            'collectionLocId': "The id of the collection loc",
        });
    }

    @HttpGet('/:collectionLocId')
    @Async()
    async getCollectionItems(_body: any, collectionLocId: string): Promise<CollectionItemsView> {
        const loc = requireDefined(await this.locRequestRepository.findById(collectionLocId),
            () => badRequest(`No LOC with ID ${collectionLocId}`));
        (await this.authenticationService.authenticatedUser(this.request))
            .isOneOf([ loc.ownerAddress, loc.requesterAddress ]);

        const collectionItems = await this.collectionRepository.findAllBy(collectionLocId);
        return {
            items: collectionItems.map(item => item.getDescription()).map(this.toView),
        }
    }

    private toView(collectionItem: CollectionItemDescription): CollectionItemView {
        const { collectionLocId, itemId, addedOn, files } = collectionItem;
        return {
            collectionLocId,
            itemId,
            addedOn: addedOn?.toISOString(),
            files: files?.map(file => file.hash)
        }
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
        requireDefined(
            await this.logionNodeCollectionService.getCollectionItem({ collectionLocId, itemId }),
            () => badRequest(`Collection item ${ collectionLocId }/${ itemId } not found`));

        const collectionItem = await this.collectionRepository.findBy(collectionLocId, itemId);
        if (collectionItem) {
            return this.toView(collectionItem.getDescription())
        } else {
            return this.toView({
                collectionLocId,
                itemId,
                files: []
            })
        }
    }

    static addFile(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/collection/{collectionLocId}/{itemId}/files"].post!;
        operationObject.summary = "Adds a file to a Collection Item";
        operationObject.description = "The authenticated user must be the requester of the LOC.";
        operationObject.responses = getDefaultResponsesNoContent();
        operationObject.requestBody = getRequestBody({
            description: "File upload data",
            view: "FileUploadData",
        });
        setPathParameters(operationObject, {
                'collectionLocId': "The ID of the Collection LOC",
                'itemId': "The ID of the Collection Item",
            });
    }

    @HttpPost('/:collectionLocId/:itemId/files')
    @Async()
    async addFile(body: FileUploadData, collectionLocId: string, itemId: string): Promise<void> {
        const collectionLoc = requireDefined(await this.locRequestRepository.findById(collectionLocId),
            () => badRequest(`Collection ${ collectionLocId } not found`));
        await this.authenticationService.authenticatedUserIs(this.request, collectionLoc.requesterAddress);

        const publishedCollectionItem = await this.logionNodeCollectionService.getCollectionItem({ collectionLocId, itemId })
        if (!publishedCollectionItem) {
            throw badRequest("Collection Item not found on chain")
        }

        const hash = requireDefined(body.hash, () => badRequest("No hash found for upload file"));
        const file = await getUploadedFile(this.request, hash);

        const publishedCollectionItemFile = await this.getCollectionItemFile({
            collectionLocId,
            itemId,
            hash
        });
        if (BigInt(file.size) !== publishedCollectionItemFile.size) {
            throw badRequest(`Invalid size. Actually uploaded ${ file.size } bytes while expecting ${ publishedCollectionItemFile.size } bytes`);
        }
        if (file.name !== publishedCollectionItemFile.name) {
            throw badRequest(`Invalid name. Actually uploaded ${ file.name } while expecting ${ publishedCollectionItemFile.name }`);
        }

        const collectionItem = await this.collectionService.createIfNotExist(collectionLocId, itemId, () =>
            this.collectionFactory.newItem({ collectionLocId, itemId } )
        )
        if (collectionItem.hasFile(hash)) {
            throw badRequest("File is already uploaded")
        }
        const cid = await this.fileStorageService.importFile(file.tempFilePath);

        await this.collectionService.update(collectionLocId, itemId, async item => {
            item.addFile({ hash, cid });
        });
    }

    private async getCollectionItemFile(params: GetCollectionItemFileParams): Promise<ItemFile> {
        const publishedCollectionItemFile = await this.logionNodeCollectionService.getCollectionItemFile(params);
        if (publishedCollectionItemFile) {
            return publishedCollectionItemFile;
        } else {
            throw badRequest("Collection Item File not found on chain");
        }
    }

    static downloadFile(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/collection/{collectionLocId}/{itemId}/files/{hash}"].get!;
        operationObject.summary = "Downloads a file of the Collection Item";
        operationObject.description = "The authenticated user must be the owner or the requester of the LOC";
        operationObject.responses = getDefaultResponsesWithAnyBody();
        setPathParameters(operationObject, {
            'collectionLocId': "The ID of the Collection LOC",
            'itemId': "The ID of the Collection Item",
            'hash': "The hash of the file",
        });
    }

    @HttpGet('/:collectionLocId/:itemId/files/:hash')
    @Async()
    @SendsResponse()
    async downloadFile(_body: any, collectionLocId: string, itemId: string, hash: string): Promise<void> {
        const authenticated = await this.authenticationService.authenticatedUser(this.request);
        const collectionItem = await this.checkCanDownload(authenticated, collectionLocId, itemId, hash);

        const publishedCollectionItemFile = await this.getCollectionItemFile({
            collectionLocId,
            itemId,
            hash
        });

        const file = collectionItem.getFile(hash);
        const tempFilePath = CollectionController.tempFilePath({ collectionLocId, itemId, hash });
        await this.fileStorageService.exportFile(file, tempFilePath);

        const generatedOn = moment();
        const owner = authenticated.address;
        await this.restrictedDeliveryService.setMetadata({
            file: tempFilePath,
            metadata: {
                owner,
                generatedOn,
            }
        });
        const deliveredFileHash = await sha256File(tempFilePath);

        await this.collectionService.update(collectionLocId, itemId, async item => {
            const file = item.getFile(hash);
            file.addDeliveredFile({ deliveredFileHash, generatedOn, owner });
        });

        downloadAndClean({
            response: this.response,
            path: tempFilePath,
            name: publishedCollectionItemFile.name,
            contentType: publishedCollectionItemFile.contentType,
        });
    }

    private async checkCanDownload(authenticated: AuthenticatedUser, collectionLocId: string, itemId: string, hash: string): Promise<CollectionItemAggregateRoot> {
        const publishedCollectionItem = requireDefined(await this.logionNodeCollectionService.getCollectionItem({
            collectionLocId,
            itemId
        }), () => badRequest(`Collection item ${ collectionLocId } not found on-chain`));

        const collectionItem = await this.getCollectionItemWithFile(collectionLocId, itemId, hash);

        if(!publishedCollectionItem.restrictedDelivery) {
            throw forbidden("No delivery allowed for this item's files");
        } else if(! await this.ownershipCheckService.isOwner(authenticated.address, publishedCollectionItem)) {
            throw forbidden(`${authenticated.address} does not seem to be the owner of this item's underlying token`);
        } else {
            return collectionItem;
        }
    }

    private async getCollectionItemWithFile(collectionLocId: string, itemId: string, hash: string): Promise<CollectionItemAggregateRoot> {
        const collectionItem = requireDefined(
            await this.collectionRepository.findBy(collectionLocId, itemId),
            () => badRequest(`Collection item ${ collectionLocId }/${ itemId } not found in DB`));
        if (!collectionItem.hasFile(hash)) {
            throw badRequest("Trying to download a file that is not uploaded yet.")
        }
        return collectionItem;
    }

    static tempFilePath(params: { collectionLocId: string, itemId: string, hash: string } ) {
        const { collectionLocId, itemId, hash } = params
        return path.join(os.tmpdir(), `download-${ collectionLocId }-${ itemId }-${ hash }`)
    }

    static canDownloadFile(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/collection/{collectionLocId}/{itemId}/files/{hash}/check"].get!;
        operationObject.summary = "Tells if a file of the Collection Item can be downloaded by authenticated user";
        operationObject.description = "The authenticated user must be the owner of the underlying token";
        operationObject.responses = getDefaultResponsesWithAnyBody();
        setPathParameters(operationObject, {
            'collectionLocId': "The ID of the Collection LOC",
            'itemId': "The ID of the Collection Item",
            'hash': "The hash of the file",
        });
    }

    @HttpGet('/:collectionLocId/:itemId/files/:hash/check')
    @Async()
    async canDownloadFile(_body: any, collectionLocId: string, itemId: string, hash: string): Promise<void> {
        const authenticated = await this.authenticationService.authenticatedUser(this.request);
        await this.checkCanDownload(authenticated, collectionLocId, itemId, hash);
    }

    static getLatestDeliveries(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/collection/{collectionLocId}/{itemId}/latest-deliveries"].get!;
        operationObject.summary = "Provides information about the latest copies delivered to the item's token owner";
        operationObject.description = "This is a public resource";
        operationObject.responses = getDefaultResponsesWithAnyBody();
        setPathParameters(operationObject, {
            'collectionLocId': "The ID of the Collection LOC",
            'itemId': "The ID of the Collection Item",
        });
    }

    @HttpGet('/:collectionLocId/:itemId/latest-deliveries')
    @Async()
    async getLatestDeliveries(_body: any, collectionLocId: string, itemId: string): Promise<ItemDeliveriesResponse> {
        return this.getDeliveries({ collectionLocId, itemId, limitPerFile: 1 });
    }

    private async getDeliveries(query: { collectionLocId: string, itemId: string, fileHash?: string, limitPerFile?: number }): Promise<ItemDeliveriesResponse> {
        const { collectionLocId, itemId, fileHash, limitPerFile } = query;
        const item = requireDefined(await this.logionNodeCollectionService.getCollectionItem({
            collectionLocId,
            itemId
        }), () => badRequest(`Collection item ${ collectionLocId } not found on-chain`));
        const delivered = await this.collectionRepository.findLatestDeliveries({ collectionLocId, itemId, fileHash });
        if(!delivered) {
            throw badRequest("Original file not found or it was never delivered yet");
        } else {
            return this.mapCollectionItemFilesDelivered(item, delivered, limitPerFile);
        }
    }

    private async mapCollectionItemFilesDelivered(item: CollectionItem, delivered: Record<string, CollectionItemFileDelivered[]>, limitPerFile?: number): Promise<ItemDeliveriesResponse> {
        const owners = new Set<string>();
        for(const fileHash of Object.keys(delivered)) {
            const owner = delivered[fileHash][0].owner; // Only check latest owners
            if(owner) {
                owners.add(owner);
            }
        }

        const ownershipMap: Record<string, boolean> = {};
        for(const owner of owners.values()) {
            ownershipMap[owner] = await this.ownershipCheckService.isOwner(owner, item);
        }

        const view: ItemDeliveriesResponse = {};
        for(const fileHash of Object.keys(delivered)) {
            view[fileHash] = delivered[fileHash].slice(0, limitPerFile).map(delivery => this.mapCollectionItemFileDelivered(delivery, ownershipMap));
        }
        return view;
    }

    private mapCollectionItemFileDelivered(delivered: CollectionItemFileDelivered, ownershipMap: Record<string, boolean>): CheckLatestDeliveryResponse {
        return {
            copyHash: delivered.deliveredFileHash,
            generatedOn: moment(delivered.generatedOn).toISOString(),
            owner: delivered.owner,
            belongsToCurrentOwner: ownershipMap[delivered.owner || ""] || false,
        }
    }

    static getAllDeliveries(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/collection/{collectionLocId}/{itemId}/all-deliveries"].get!;
        operationObject.summary = "Provides information about all copies delivered to the item's token owners";
        operationObject.description = "Only item's collection LOC owner is authorized";
        operationObject.responses = getDefaultResponsesWithAnyBody();
        setPathParameters(operationObject, {
            'collectionLocId': "The ID of the Collection LOC",
            'itemId': "The ID of the Collection Item",
        });
    }

    @HttpGet('/:collectionLocId/:itemId/all-deliveries')
    @Async()
    async getAllDeliveries(_body: any, collectionLocId: string, itemId: string): Promise<ItemDeliveriesResponse> {
        const collectionLoc = requireDefined(await this.locRequestRepository.findById(collectionLocId),
            () => badRequest(`Collection ${ collectionLocId } not found`));
        await this.authenticationService.authenticatedUserIsOneOf(this.request, collectionLoc.ownerAddress, collectionLoc.requesterAddress);

        return this.getDeliveries({ collectionLocId, itemId });
    }

    @HttpGet('/:collectionLocId/:itemId/files/:hash/source')
    @Async()
    @SendsResponse()
    async downloadFileSource(_body: any, collectionLocId: string, itemId: string, hash: string): Promise<void> {
        const authenticated = await this.authenticationService.authenticatedUser(this.request);
        const collectionLoc = requireDefined(await this.locRequestRepository.findById(collectionLocId),
            () => badRequest("Collection LOC not found"));
        authenticated.require(user => user.isOneOf([
            collectionLoc.ownerAddress,
            requireDefined(collectionLoc.requesterAddress)
        ]));

        const publishedCollectionItemFile = await this.getCollectionItemFile({
            collectionLocId,
            itemId,
            hash
        });

        const collectionItem = await this.getCollectionItemWithFile(collectionLocId, itemId, hash);
        const file = collectionItem.getFile(hash);
        const tempFilePath = CollectionController.tempFilePath({ collectionLocId, itemId, hash });
        await this.fileStorageService.exportFile(file, tempFilePath);

        downloadAndClean({
            response: this.response,
            path: tempFilePath,
            name: publishedCollectionItemFile.name,
            contentType: publishedCollectionItemFile.contentType,
        });
    }
}
