import { injectable } from "inversify";
import { Controller, ApiController, Async, HttpGet, HttpPost, SendsResponse } from "dinoloop";
import { CollectionRepository, CollectionFactory, CollectionItemDescription, CollectionItemAggregateRoot } from "../model/collection.model";
import { components } from "./components";
import { requireDefined } from "../lib/assertions";
import { OpenAPIV3 } from "express-oas-generator";
import moment from "moment";
import {
    addTag,
    setControllerTag,
    getPublicResponses,
    setPathParameters,
    getDefaultResponses,
    getDefaultResponsesWithAnyBody
} from "./doc";
import { badRequest, forbidden } from "./errors";
import { LocRequestRepository } from "../model/locrequest.model";
import { AuthenticationService, LogionUserCheck } from "../services/authentication.service";
import { getUploadedFile } from "./fileupload";
import { sha256File } from "../lib/crypto/hashing";
import { FileStorageService } from "../services/file.storage.service";
import { rm } from "fs/promises";
import { Log } from "../util/Log";
import { CollectionService, GetCollectionItemFileParams } from "../services/collection.service";
import { ItemFile } from "@logion/node-api/dist/Types";
import os from "os";
import path from "path";
import { OwnershipCheckService } from "../services/ownershipcheck.service";
import { RestrictedDeliveryService } from "../services/restricteddelivery.service";

const { logger } = Log;

type CollectionItemView = components["schemas"]["CollectionItemView"];
type AddFileResultView = components["schemas"]["AddFileResultView"];
type CheckLatestDeliveryResponse = components["schemas"]["CheckLatestDeliveryResponse"];

export function fillInSpec(spec: OpenAPIV3.Document): void {
    const tagName = 'Collections';
    addTag(spec, {
        name: tagName,
        description: "Handling of Collections"
    });
    setControllerTag(spec, /^\/api\/collection.*/, tagName);

    CollectionController.getCollectionItem(spec)
    CollectionController.addFile(spec)
    CollectionController.downloadFile(spec)
    CollectionController.canDownloadFile(spec)
    CollectionController.getLatestDelivery(spec)
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
        private collectionService: CollectionService,
        private ownershipCheckService: OwnershipCheckService,
        private restrictedDeliveryService: RestrictedDeliveryService,
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
        requireDefined(
            await this.collectionService.getCollectionItem({ collectionLocId, itemId }),
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

    private toView(collectionItem: CollectionItemDescription): CollectionItemView {
        const { collectionLocId, itemId, addedOn, files } = collectionItem;
        return {
            collectionLocId,
            itemId,
            addedOn: addedOn?.toISOString(),
            files: files?.map(file => file.hash)
        }
    }

    static addFile(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/collection/{collectionLocId}/{itemId}/files"].post!;
        operationObject.summary = "Adds a file to a Collection Item";
        operationObject.description = "The authenticated user must be the requester of the LOC.";
        operationObject.responses = getDefaultResponses("AddFileResultView");
        setPathParameters(operationObject, {
                'collectionLocId': "The ID of the Collection LOC",
                'itemId': "The ID of the Collection Item",
            });
    }

    @HttpPost('/:collectionLocId/:itemId/files')
    @Async()
    async addFile(_body: any, collectionLocId: string, itemId: string): Promise<AddFileResultView> {
        const collectionLoc = requireDefined(await this.locRequestRepository.findById(collectionLocId),
            () => badRequest(`Collection ${ collectionLocId } not found`));
        await this.authenticationService.authenticatedUserIs(this.request, collectionLoc.requesterAddress);

        const publishedCollectionItem = await this.collectionService.getCollectionItem({ collectionLocId, itemId })
        if (!publishedCollectionItem) {
            throw badRequest("Collection Item not found on chain")
        }

        const file = getUploadedFile(this.request);
        const hash = await sha256File(file.tempFilePath);

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

        const collectionItem = await this.collectionRepository.createIfNotExist(collectionLocId, itemId, () =>
            this.collectionFactory.newItem({ collectionLocId, itemId } )
        )
        if (collectionItem.hasFile(hash)) {
            throw badRequest("File is already uploaded")
        }
        const cid = await this.fileStorageService.importFile(file.tempFilePath);

        const collectionItemFile = collectionItem.addFile({ hash, cid })
        await this.collectionRepository.saveFile(collectionItemFile);

        return { hash };
    }

    private async getCollectionItemFile(params: GetCollectionItemFileParams): Promise<ItemFile> {
        const publishedCollectionItemFile = await this.collectionService.getCollectionItemFile(params);
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
        const delivered = file.addDeliveredFile({ deliveredFileHash, generatedOn, owner });
        await this.collectionRepository.saveDelivered(delivered);

        this.response.download(tempFilePath, publishedCollectionItemFile.name, { headers: { "content-type": publishedCollectionItemFile.contentType } }, (error: any) => {
            rm(tempFilePath);
            if(error) {
                logger.error("Download failed: %s", error);
            }
        });
    }

    private async checkCanDownload(authenticated: LogionUserCheck, collectionLocId: string, itemId: string, hash: string): Promise<CollectionItemAggregateRoot> {
        const publishedCollectionItem = requireDefined(await this.collectionService.getCollectionItem({
            collectionLocId,
            itemId
        }), () => badRequest(`Collection item ${ collectionLocId } not found on-chain`));

        const collectionItem = requireDefined(
            await this.collectionRepository.findBy(collectionLocId, itemId),
            () => badRequest(`Collection item ${ collectionLocId }/${ itemId } not found in DB`));
        if (!collectionItem.hasFile(hash)) {
            throw badRequest("Trying to download a file that is not uploaded yet.")
        }

        if(!publishedCollectionItem.restrictedDelivery) {
            throw forbidden("No delivery allowed for this item's files");
        } else if(! await this.ownershipCheckService.isOwner(authenticated.address, publishedCollectionItem)) {
            throw forbidden(`${authenticated.address} does not seem to be the owner of this item's underlying token`);
        } else {
            return collectionItem;
        }
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

    static getLatestDelivery(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/collection/{collectionLocId}/{itemId}/files/{hash}/latest-delivery"].get!;
        operationObject.summary = "Provides information about the latest copy delivered to its owner";
        operationObject.description = "";
        operationObject.responses = getDefaultResponsesWithAnyBody();
        setPathParameters(operationObject, {
            'collectionLocId': "The ID of the Collection LOC",
            'itemId': "The ID of the Collection Item",
            'hash': "The hash of the original file",
        });
    }

    @HttpGet('/:collectionLocId/:itemId/files/:hash/latest-delivery')
    @Async()
    async getLatestDelivery(_body: any, collectionLocId: string, itemId: string, hash: string): Promise<CheckLatestDeliveryResponse> {
        const delivered = await this.collectionRepository.findLatestDelivery({ collectionLocId, itemId, fileHash: hash });
        if(!delivered) {
            throw badRequest("Original file not found or it was never delivered yet");
        } else {
            return {
                copyHash: delivered.deliveredFileHash,
                generatedOn: moment(delivered.generatedOn).toISOString(),
                owner: delivered.owner,
            }
        }
    }
}
