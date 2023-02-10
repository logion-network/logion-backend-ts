import { AuthenticatedUser } from "@logion/authenticator";
import { injectable } from "inversify";
import { Controller, ApiController, Async, HttpGet, HttpPost, SendsResponse, HttpPut } from "dinoloop";
import {
    CollectionRepository,
    CollectionFactory,
    CollectionItemDescription,
    CollectionItemAggregateRoot,
    CollectionItemFileDelivered
} from "../model/collection.model.js";
import { components } from "./components.js";
import { OpenAPIV3 } from "express-oas-generator";
import moment from "moment";
import {
    LocRequestRepository,
    FileDescription,
    LocRequestAggregateRoot,
    LocFileDelivered
} from "../model/locrequest.model.js";
import { getUploadedFile } from "./fileupload.js";
import { sha256File } from "../lib/crypto/hashing.js";
import { FileStorageService } from "../services/file.storage.service.js";
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
    getDefaultResponses,
} from "@logion/rest-api-core";
import {
    CollectionService,
    GetCollectionItemFileParams,
    LogionNodeCollectionService
} from "../services/collection.service.js";
import { CollectionItem, ItemFile } from "@logion/node-api";
import os from "os";
import path from "path";
import { OwnershipCheckService } from "../services/ownershipcheck.service.js";
import { RestrictedDeliveryService } from "../services/restricteddelivery.service.js";
import { downloadAndClean } from "../lib/http.js";
import { LocRequestService } from "../services/locrequest.service.js";

type CollectionItemView = components["schemas"]["CollectionItemView"];
type CollectionItemsView = components["schemas"]["CollectionItemsView"];
type CheckLatestItemDeliveryResponse = components["schemas"]["CheckLatestItemDeliveryResponse"];
type ItemDeliveriesResponse = components["schemas"]["ItemDeliveriesResponse"];
type CheckCollectionDeliveryResponse = components["schemas"]["CheckCollectionDeliveryResponse"];
type CheckCollectionDeliveryWitheOriginalResponse = components["schemas"]["CheckCollectionDeliveryWitheOriginalResponse"];
type CollectionFileDeliveriesResponse = components["schemas"]["CollectionFileDeliveriesResponse"];
type CollectionDeliveriesResponse = components["schemas"]["CollectionDeliveriesResponse"];
type FileUploadData = components["schemas"]["FileUploadData"];
type UpdateCollectionFile = components["schemas"]["UpdateCollectionFile"];
type CheckCollectionDeliveryRequest = components["schemas"]["CheckCollectionDeliveryRequest"];

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
    CollectionController.downloadItemFile(spec)
    CollectionController.downloadCollectionFile(spec)
    CollectionController.checkOwnership(spec)
    CollectionController.canDownloadItemFile(spec)
    CollectionController.canDownloadCollectionFile(spec)
    CollectionController.updateCollectionFile(spec)
    CollectionController.getLatestItemDeliveries(spec)
    CollectionController.getAllItemDeliveries(spec)
    CollectionController.getAllCollectionFileDeliveries(spec)
    CollectionController.getAllCollectionDeliveries(spec)
    CollectionController.checkOneCollectionFileDelivery(spec)
    CollectionController.downloadFileSource(spec)
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
        private locRequestService: LocRequestService,
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
        const operationObject = spec.paths["/api/collection/{collectionLocId}/items/{itemId}"].get!;
        operationObject.summary = "Gets the info of a published Collection Item";
        operationObject.description = "No authentication required.";
        operationObject.responses = getPublicResponses("CollectionItemView");
        setPathParameters(operationObject, {
            'collectionLocId': "The id of the collection loc",
            'itemId': "The id of the collection item"
        });
    }

    @HttpGet('/:collectionLocId/items/:itemId')
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

    static downloadItemFile(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/collection/{collectionLocId}/{itemId}/files/{hash}"].get!;
        operationObject.summary = "Downloads a copy of a file of the Collection Item";
        operationObject.description = "The authenticated user must be the owner of the underlying token";
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
    async downloadItemFile(_body: any, collectionLocId: string, itemId: string, hash: string): Promise<void> {
        const authenticated = await this.authenticationService.authenticatedUser(this.request);
        const collectionItem = await this.checkCanDownloadItemFile(authenticated, collectionLocId, itemId, hash);

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

    private async checkCanDownloadItemFile(authenticated: AuthenticatedUser, collectionLocId: string, itemId: string, hash: string): Promise<CollectionItemAggregateRoot> {
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

    static downloadCollectionFile(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/collection/{collectionLocId}/files/{hash}/{itemId}"].get!;
        operationObject.summary = "Downloads a copy of a file of the Collection LOC";
        operationObject.description = "The authenticated user must be owner of the collection item";
        operationObject.responses = getDefaultResponsesWithAnyBody();
        setPathParameters(operationObject, {
            'collectionLocId': "The ID of the Collection LOC",
            'hash': "The hash of the file to download",
            'itemId': "The ID of the collection item, used to validate that user is entitled to download file",
        });
    }

    @HttpGet('/:collectionLocId/files/:hash/:itemId')
    @Async()
    @SendsResponse()
    async downloadCollectionFile(_body: any, collectionLocId: string, hash: string, itemId: string): Promise<void> {
        const authenticated = await this.authenticationService.authenticatedUser(this.request);
        const file = await this.checkCanDownloadCollectionFile(authenticated, collectionLocId, hash, itemId);
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

        await this.locRequestService.update(collectionLocId, async collection => {
            collection.addDeliveredFile({ hash, deliveredFileHash, generatedOn, owner });
        });

        downloadAndClean({
            response: this.response,
            path: tempFilePath,
            name: file.name,
            contentType: file.contentType,
        });
    }

    private async checkCanDownloadCollectionFile(authenticated: AuthenticatedUser, collectionLocId: string, hash: string, itemId: string): Promise<FileDescription> {
        const collection = requireDefined(await this.locRequestRepository.findById(collectionLocId));
        if (!collection.hasFile(hash)) {
            throw badRequest("Trying to download a file that is not uploaded yet.")
        }
        const file = collection.getFile(hash);
        const publishedCollectionItem = requireDefined(await this.logionNodeCollectionService.getCollectionItem({
            collectionLocId,
            itemId
        }), () => badRequest(`Collection item ${ collectionLocId } not found on-chain`));
        if(!file.restrictedDelivery) {
            throw forbidden("No delivery allowed for this collection's files");
        } else if(! await this.ownershipCheckService.isOwner(authenticated.address, publishedCollectionItem)) {
            throw forbidden(`${authenticated.address} does not seem to be the owner of this item's underlying token`);
        } else {
            return file;
        }
    }

    static tempFilePath(params: { collectionLocId: string, itemId: string, hash: string } ) {
        const { collectionLocId, itemId, hash } = params
        return path.join(os.tmpdir(), `download-${ collectionLocId }-${ itemId }-${ hash }`)
    }

    static checkOwnership(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/collection/{collectionLocId}/items/{itemId}/check"].get!;
        operationObject.summary = "Tells if the Collection Item is owned by authenticated user";
        operationObject.description = "The authenticated user must be the owner of the underlying token";
        operationObject.responses = getDefaultResponsesWithAnyBody();
        setPathParameters(operationObject, {
            'collectionLocId': "The ID of the Collection LOC",
            'itemId': "The ID of the Collection Item",
        });
    }

    @HttpGet('/:collectionLocId/items/:itemId/check')
    @Async()
    async checkOwnership(_body: any, collectionLocId: string, itemId: string): Promise<void> {
        const authenticated = await this.authenticationService.authenticatedUser(this.request);
        const publishedCollectionItem = requireDefined(await this.logionNodeCollectionService.getCollectionItem({
            collectionLocId,
            itemId
        }), () => badRequest(`Collection item ${ collectionLocId } not found on-chain`));
        if(! await this.ownershipCheckService.isOwner(authenticated.address, publishedCollectionItem)) {
            throw forbidden(`${authenticated.address} does not seem to be the owner of this item's underlying token`);
        }
    }

    static canDownloadItemFile(spec: OpenAPIV3.Document) {
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
    async canDownloadItemFile(_body: any, collectionLocId: string, itemId: string, hash: string): Promise<void> {
        const authenticated = await this.authenticationService.authenticatedUser(this.request);
        await this.checkCanDownloadItemFile(authenticated, collectionLocId, itemId, hash);
    }

    static canDownloadCollectionFile(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/collection/{collectionLocId}/files/{hash}/{itemId}/check"].get!;
        operationObject.summary = "Tells if a file of the Collection Item can be downloaded by authenticated user";
        operationObject.description = "The authenticated user must be the owner of the underlying token";
        operationObject.responses = getDefaultResponsesWithAnyBody();
        setPathParameters(operationObject, {
            'collectionLocId': "The ID of the Collection LOC",
            'hash': "The hash of the file",
            'itemId': "The ID of the collection item, used to validate that user is entitled to download file",
        });
    }

    @HttpGet('/:collectionLocId/files/:hash/:itemId/check')
    @Async()
    async canDownloadCollectionFile(_body: any, collectionLocId: string, itemId: string, hash: string): Promise<void> {
        const authenticated = await this.authenticationService.authenticatedUser(this.request);
        await this.checkCanDownloadCollectionFile(authenticated, collectionLocId, hash, itemId);
    }

    static updateCollectionFile(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/collection/{collectionLocId}/files/{hash}"].put!;
        operationObject.summary = "Enables/disables restricted delivery on a file of the Collection LOC";
        operationObject.description = "The authenticated user must be owner of the LOC";
        operationObject.responses = getDefaultResponses("UpdateCollectionFile");
        setPathParameters(operationObject, {
            'collectionLocId': "The ID of the Collection LOC",
            'hash': "The hash of the file to download",
        });
    }

    @HttpPut('/:collectionLocId/files/:hash')
    @Async()
    async updateCollectionFile(body: UpdateCollectionFile, collectionLocId: string, hash: string): Promise<void> {
        const authenticated = await this.authenticationService.authenticatedUser(this.request);
        await this.locRequestService.update(collectionLocId, async collection => {
            authenticated.require(user => user.is(collection.ownerAddress));
            collection.updateFile({
                hash,
                restrictedDelivery: body.restrictedDelivery || false
            });
        });
    }

    static getLatestItemDeliveries(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/collection/{collectionLocId}/{itemId}/latest-deliveries"].get!;
        operationObject.summary = "Provides information about the latest copies delivered to the item's token owner";
        operationObject.description = "This is a public resource";
        operationObject.responses = getDefaultResponses("ItemDeliveriesResponse");
        setPathParameters(operationObject, {
            'collectionLocId': "The ID of the Collection LOC",
            'itemId': "The ID of the Collection Item",
        });
    }

    @HttpGet('/:collectionLocId/:itemId/latest-deliveries')
    @Async()
    async getLatestItemDeliveries(_body: any, collectionLocId: string, itemId: string): Promise<ItemDeliveriesResponse> {
        return this.getItemDeliveries({ collectionLocId, itemId, limitPerFile: 1 });
    }

    private async getItemDeliveries(query: { collectionLocId: string, itemId: string, fileHash?: string, limitPerFile?: number }): Promise<ItemDeliveriesResponse> {
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

    private mapCollectionItemFileDelivered(delivered: CollectionItemFileDelivered, ownershipMap: Record<string, boolean>): CheckLatestItemDeliveryResponse {
        return {
            copyHash: delivered.deliveredFileHash,
            generatedOn: moment(delivered.generatedOn).toISOString(),
            owner: delivered.owner,
            belongsToCurrentOwner: ownershipMap[delivered.owner || ""] || false,
        }
    }

    static getAllItemDeliveries(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/collection/{collectionLocId}/{itemId}/all-deliveries"].get!;
        operationObject.summary = "Provides information about all delivered copies of a collection file";
        operationObject.description = "Only collection LOC owner is authorized";
        operationObject.responses = getDefaultResponses("ItemDeliveriesResponse");
        setPathParameters(operationObject, {
            'collectionLocId': "The ID of the Collection LOC",
            'itemId': "The ID of the Collection Item",
        });
    }

    @HttpGet('/:collectionLocId/:itemId/all-deliveries')
    @Async()
    async getAllItemDeliveries(_body: any, collectionLocId: string, itemId: string): Promise<ItemDeliveriesResponse> {
        const collectionLoc = requireDefined(await this.locRequestRepository.findById(collectionLocId),
            () => badRequest(`Collection ${ collectionLocId } not found`));
        await this.authenticationService.authenticatedUserIsOneOf(this.request, collectionLoc.ownerAddress, collectionLoc.requesterAddress);

        return this.getItemDeliveries({ collectionLocId, itemId });
    }

    static getAllCollectionFileDeliveries(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/collection/{collectionLocId}/file-deliveries/{hash}"].get!;
        operationObject.summary = "Provides information about all copies delivered to the item's token owners";
        operationObject.description = "Only item's collection LOC owner is authorized";
        operationObject.responses = getDefaultResponses("CollectionFileDeliveriesResponse");
        setPathParameters(operationObject, {
            'collectionLocId': "The ID of the Collection LOC",
            'hash': "The hash of the Collection File",
        });
    }

    @HttpGet('/:collectionLocId/file-deliveries/:hash')
    @Async()
    async getAllCollectionFileDeliveries(_body: any, collectionLocId: string, hash: string): Promise<CollectionFileDeliveriesResponse> {
        const collectionLoc = requireDefined(await this.locRequestRepository.findById(collectionLocId),
            () => badRequest(`Collection ${ collectionLocId } not found`));
        await this.authenticationService.authenticatedUserIsOneOf(this.request, collectionLoc.ownerAddress, collectionLoc.requesterAddress);

        const deliveries = await this._getAllCollectionFileDeliveries({ collectionLoc, hash });
        return { deliveries };
    }

    private async _getAllCollectionFileDeliveries(query: { collectionLoc: LocRequestAggregateRoot, hash: string }): Promise<CheckCollectionDeliveryResponse[]> {
        const { collectionLoc, hash } = query;
        if (!collectionLoc.hasFile(hash)) {
            throw badRequest("File not found")
        }
        const delivered = await this.locRequestRepository.findAllDeliveries({
            collectionLocId: collectionLoc.id!,
            hash
        });
        return delivered[hash].map(this.mapToResponse);
    }

    static checkOneCollectionFileDelivery(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/collection/{collectionLocId}/file-deliveries"].put!;
        operationObject.summary = "Provides information about one delivered collection file copy";
        operationObject.description = "This is a public resource";
        operationObject.requestBody = getRequestBody({
            description: "Candidate Collection File Delivered Copy Hash",
            view: "CheckCollectionDeliveryRequest"});
        operationObject.responses = getPublicResponses("CheckCollectionDeliveryWitheOriginalResponse");
        setPathParameters(operationObject, {
            'collectionLocId': "The ID of the Collection LOC"
        });
    }

    @HttpPut('/:collectionLocId/file-deliveries')
    @Async()
    async checkOneCollectionFileDelivery(body: CheckCollectionDeliveryRequest, collectionLocId: string): Promise<CheckCollectionDeliveryWitheOriginalResponse> {
        const deliveredFileHash = requireDefined(body.copyHash, () => badRequest("Missing attribute copyHash"))
        const delivery = await this.locRequestRepository.findDeliveryByDeliveredFileHash({ collectionLocId, deliveredFileHash })
        if (delivery === null) {
            throw badRequest("Provided copyHash is not from a delivered copy of a file from the collection")
        }
        return {
            ...this.mapToResponse(delivery),
            originalFileHash: delivery.hash
        };
    }

    private mapToResponse(deliveredCopy: LocFileDelivered): CheckCollectionDeliveryResponse {
        return {
            copyHash: deliveredCopy.deliveredFileHash,
            owner: deliveredCopy.owner,
            generatedOn: moment(deliveredCopy.generatedOn).toISOString(),
        }
    }

    static getAllCollectionDeliveries(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/collection/{collectionLocId}/file-deliveries"].get!;
        operationObject.summary = "Provides information about all delivered copies";
        operationObject.description = "Only item's collection LOC owner is authorized";
        operationObject.responses = getDefaultResponses("CollectionDeliveriesResponse");
        setPathParameters(operationObject, {
            'collectionLocId': "The ID of the Collection LOC"
        });
    }

    @HttpGet('/:collectionLocId/file-deliveries')
    @Async()
    async getAllCollectionDeliveries(_body: any, collectionLocId: string): Promise<CollectionDeliveriesResponse> {
        const collectionLoc = requireDefined(await this.locRequestRepository.findById(collectionLocId),
            () => badRequest(`Collection ${ collectionLocId } not found`));
        await this.authenticationService.authenticatedUserIsOneOf(this.request, collectionLoc.ownerAddress, collectionLoc.requesterAddress);

        return await this._getAllCollectionDeliveries({ collectionLoc });
    }

    private async _getAllCollectionDeliveries(query: { collectionLoc: LocRequestAggregateRoot }): Promise<CollectionDeliveriesResponse> {
        const { collectionLoc } = query;
        const delivered = await this.locRequestRepository.findAllDeliveries({ collectionLocId: collectionLoc.id! });
        const view: CollectionDeliveriesResponse = {};
        for(const fileHash of Object.keys(delivered)) {
            view[fileHash] = delivered[fileHash].map(this.mapToResponse)
        }
        return view;
    }

    static downloadFileSource(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/collection/{collectionLocId}/{itemId}/files/{hash}/source"].get!;
        operationObject.summary = "Downloads the source of a file of the Collection Item";
        operationObject.description = "The authenticated user must be the owner or the requester of the LOC";
        operationObject.responses = getDefaultResponsesWithAnyBody();
        setPathParameters(operationObject, {
            'collectionLocId': "The ID of the Collection LOC",
            'itemId': "The ID of the Collection Item",
            'hash': "The hash of the file",
        });
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
