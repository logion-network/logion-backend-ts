import { AuthenticatedUser } from "@logion/authenticator";
import { Hash } from "@logion/node-api";
import { injectable } from "inversify";
import { Controller, ApiController, Async, HttpGet, HttpPost, HttpPut, SendsResponse , HttpDelete} from "dinoloop";
import {
    TokensRecordRepository,
    TokensRecordFactory,
    TokensRecordDescription,
    TokensRecordAggregateRoot,
    TokensRecordFileDelivered,
    TokensRecordFileDescription
} from "../model/tokensrecord.model.js";
import { components } from "./components.js";
import { OpenAPIV3 } from "express-oas-generator";
import moment from "moment";
import {
    LocRequestRepository,
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
import os from "os";
import path from "path";
import { OwnershipCheckService } from "../services/ownershipcheck.service.js";
import { RestrictedDeliveryService } from "../services/restricteddelivery.service.js";
import { downloadAndClean } from "../lib/http.js";
import { GetTokensRecordFileParams, LogionNodeTokensRecordService, TokensRecordService } from "../services/tokensrecord.service.js";
import { LocAuthorizationService } from "../services/locauthorization.service.js";
import { CollectionRepository } from "../model/collection.model.js";

type TokensRecordView = components["schemas"]["TokensRecordView"];
type TokensRecordsView = components["schemas"]["TokensRecordsView"];
type CheckLatestItemDeliveryResponse = components["schemas"]["CheckLatestItemDeliveryResponse"];
type ItemDeliveriesResponse = components["schemas"]["ItemDeliveriesResponse"];
type FileUploadData = components["schemas"]["FileUploadData"];
type CheckCollectionDeliveryRequest = components["schemas"]["CheckCollectionDeliveryRequest"];
type CheckCollectionDeliveryResponse = components["schemas"]["CheckCollectionDeliveryResponse"];
type CheckCollectionDeliveryWitheOriginalResponse = components["schemas"]["CheckCollectionDeliveryWitheOriginalResponse"];
type CreateTokensRecordView = components["schemas"]["CreateTokensRecordView"];

export function fillInSpec(spec: OpenAPIV3.Document): void {
    const tagName = 'Tokens Records';
    addTag(spec, {
        name: tagName,
        description: "Handling of Tokens Records"
    });
    setControllerTag(spec, /^\/api\/records.*/, tagName);

    TokensRecordController.getTokensRecords(spec)
    TokensRecordController.getTokensRecord(spec)
    TokensRecordController.uploadFile(spec)
    TokensRecordController.downloadItemFile(spec)
    TokensRecordController.getAllItemDeliveries(spec)
    TokensRecordController.downloadFileSource(spec)
}

@injectable()
@Controller('/records')
export class TokensRecordController extends ApiController {

    constructor(
        private tokensRecordRepository: TokensRecordRepository,
        private locRequestRepository: LocRequestRepository,
        private authenticationService: AuthenticationService,
        private tokensRecordFactory: TokensRecordFactory,
        private fileStorageService: FileStorageService,
        private logionNodeTokensRecordService: LogionNodeTokensRecordService,
        private ownershipCheckService: OwnershipCheckService,
        private restrictedDeliveryService: RestrictedDeliveryService,
        private tokensRecordService: TokensRecordService,
        private collectionRepository: CollectionRepository,
        private locAuthorizationService: LocAuthorizationService,
    ) {
        super();
    }

    static getTokensRecords(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/records/{collectionLocId}"].get!;
        operationObject.summary = "Gets the info of all tokens records in a collection";
        operationObject.description = "Must be authenticated as the owner, requester of the collection.";
        operationObject.responses = getPublicResponses("TokensRecordView");
        setPathParameters(operationObject, {
            'collectionLocId': "The id of the collection loc",
        });
    }

    @HttpGet('/:collectionLocId')
    @Async()
    async getTokensRecords(_body: never, collectionLocId: string): Promise<TokensRecordsView> {
        await this.authenticationService.authenticatedUser(this.request);
        const records = await this.tokensRecordRepository.findAllBy(collectionLocId);
        return {
            records: records.map(record => record.getDescription()).map(this.toView),
        }
    }

    private toView(record: TokensRecordDescription): TokensRecordView {
        const { collectionLocId, recordId, description, addedOn, files } = record;
        return {
            collectionLocId,
            recordId: recordId.toHex(),
            description,
            addedOn: addedOn?.toISOString(),
            files: files?.map(file => ({
                hash: file.hash.toHex(),
                name: file.name,
                contentType: file.contentType,
                uploaded: file.cid !== undefined,
            })),
        }
    }

    static getTokensRecord(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/records/{collectionLocId}/record/{recordIdHex}"].get!;
        operationObject.summary = "Gets the info of a published Collection Item";
        operationObject.description = "No authentication required.";
        operationObject.responses = getPublicResponses("TokensRecordView");
        setPathParameters(operationObject, {
            'collectionLocId': "The id of the collection loc",
            'recordIdHex': "The id of the collection item"
        });
    }

    @HttpGet('/:collectionLocId/record/:recordIdHex')
    @Async()
    async getTokensRecord(_body: never, collectionLocId: string, recordIdHex: string): Promise<TokensRecordView> {
        const recordId = Hash.fromHex(recordIdHex);
        requireDefined(
            await this.logionNodeTokensRecordService.getTokensRecord({ collectionLocId, recordId }),
            () => badRequest(`Tokens Record ${ collectionLocId }/${ recordId } not found`));

        const collectionItem = await this.tokensRecordRepository.findBy(collectionLocId, recordId);
        if (collectionItem) {
            return this.toView(collectionItem.getDescription())
        } else {
            return this.toView({
                collectionLocId,
                recordId,
                files: []
            })
        }
    }

    @HttpPost('/:collectionLocId/record')
    @Async()
    async submitItemPublicData(body: CreateTokensRecordView, collectionLocId: string): Promise<void> {
        const recordId = Hash.fromHex(requireDefined(body.recordId));
        const existingItem = await this.tokensRecordRepository.findBy(collectionLocId, recordId);
        if(existingItem) {
            throw badRequest("Cannot replace existing item, you may try to cancel it first");
        }

        const description = requireDefined(body.description);
        const record = this.tokensRecordFactory.newTokensRecord({
            collectionLocId,
            recordId,
            description,
            files: body.files?.map(file => ({
                hash: Hash.fromHex(requireDefined(file.hash)),
                name: requireDefined(file.name),
                contentType: requireDefined(file.contentType),
            })),
        });

        await this.tokensRecordService.addTokensRecord(record);
    }

    @HttpDelete('/:collectionLocId/record/:recordIdHex')
    @Async()
    async cancelRecord(_body: never, collectionLocId: string, recordIdHex: string): Promise<void> {
        const recordId = Hash.fromHex(recordIdHex);
        const publishedTokensRecord = await this.logionNodeTokensRecordService.getTokensRecord({ collectionLocId, recordId });
        if (publishedTokensRecord) {
            throw badRequest("Tokens Record already published, cannot be cancelled");
        }

        const record = await this.tokensRecordRepository.findBy(collectionLocId, recordId);
        if(!record) {
            throw badRequest(`Tokens Record ${ collectionLocId } ${ recordId.toHex() } not found`);
        }

        await this.tokensRecordService.cancelTokensRecord(record);
    }

    static uploadFile(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/records/{collectionLocId}/{recordIdHex}/files"].post!;
        operationObject.summary = "Adds a file to a Collection Item";
        operationObject.description = "The authenticated user must be the requester of the LOC.";
        operationObject.responses = getDefaultResponsesNoContent();
        operationObject.requestBody = getRequestBody({
            description: "File upload data",
            view: "FileUploadData",
        });
        setPathParameters(operationObject, {
                'collectionLocId': "The ID of the Collection LOC",
                'recordIdHex': "The ID of the Collection Item",
            });
    }

    @HttpPost('/:collectionLocId/:recordIdHex/files')
    @Async()
    async uploadFile(body: FileUploadData, collectionLocId: string, recordIdHex: string): Promise<void> {
        const collectionLoc = requireDefined(await this.locRequestRepository.findById(collectionLocId),
            () => badRequest(`Collection ${ collectionLocId } not found`));

        await this.locAuthorizationService.ensureContributor(this.request, collectionLoc, true);

        const recordId = Hash.fromHex(recordIdHex);
        const publishedTokensRecord = await this.logionNodeTokensRecordService.getTokensRecord({
            collectionLocId,
            recordId
        });
        if (!publishedTokensRecord) {
            throw badRequest("Tokens Record not found on chain")
        }

        const hash = Hash.fromHex(requireDefined(body.hash, () => badRequest("No hash found for upload file")));
        const file = await getUploadedFile(this.request, hash);

        const tokensRecordFile = await this.getTokensRecordFile({
            collectionLocId,
            recordId,
            hash
        });
        if (file.size.toString() !== tokensRecordFile.size) {
            throw badRequest(`Invalid size. Actually uploaded ${ file.size } bytes while expecting ${ tokensRecordFile.size } bytes`);
        }
        if (file.name !== tokensRecordFile.name) {
            throw badRequest(`Invalid name. Actually uploaded ${ file.name } while expecting ${ tokensRecordFile.name }`);
        }

        const tokensRecord = await this.tokensRecordRepository.findBy(collectionLocId, recordId);
        if(!tokensRecord) {
            throw badRequest(`Tokens Record ${ collectionLocId }/${ recordId.toHex() } not found`);
        }
        const recordFile = tokensRecord.file(hash);
        if (!recordFile) {
            throw badRequest("Unexpected file");
        }
        if (recordFile.cid) {
            throw badRequest("File is already uploaded");
        }

        const cid = await this.fileStorageService.importFile(file.tempFilePath);
        await this.tokensRecordService.update(collectionLocId, recordId, async item => {
            item.setFileCid({ hash, cid });
        });
    }

    private async getTokensRecordFile(params: GetTokensRecordFileParams): Promise<TokensRecordFileDescription & { size: string }> {
        const dbTokensRecord = await this.tokensRecordRepository.findBy(params.collectionLocId, params.recordId);
        if(!dbTokensRecord) {
            throw badRequest("Tokens Record not found");
        }
        const dbFile = dbTokensRecord.files?.find(file => file.hash === params.hash.toHex());
        const chainFile = await this.logionNodeTokensRecordService.getTokensRecordFile(params);
        if (dbFile && chainFile) {
            return {
                ...dbFile.getDescription(),
                size: chainFile.size,
            };
        } else {
            throw badRequest("Tokens Record File not found");
        }
    }

    static downloadItemFile(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/records/{collectionLocId}/{recordIdHex}/files/{hashHex}/{itemIdHex}"].get!;
        operationObject.summary = "Downloads a copy of a file of the Collection Item";
        operationObject.description = "The authenticated user must be the owner of the underlying token";
        operationObject.responses = getDefaultResponsesWithAnyBody();
        setPathParameters(operationObject, {
            'collectionLocId': "The ID of the Collection LOC",
            'recordIdHex': "The ID of the Tokens Record",
            'hashHex': "The hash of the file",
            'itemIdHex': "The ID of the Collection Item",
        });
    }

    @HttpGet('/:collectionLocId/:recordIdHex/files/:hashHex/:itemIdHex')
    @Async()
    @SendsResponse()
    async downloadItemFile(_body: never, collectionLocId: string, recordIdHex: string, hashHex: string, itemIdHex: string): Promise<void> {
        const recordId = Hash.fromHex(recordIdHex);
        const hash = Hash.fromHex(hashHex);
        const itemId = Hash.fromHex(itemIdHex);
        const authenticated = await this.authenticationService.authenticatedUser(this.request);
        const collectionItem = await this.checkCanDownloadTokensRecordFile(authenticated, collectionLocId, recordId, hash, itemId);

        const tokensRecordFile = await this.getTokensRecordFile({
            collectionLocId,
            recordId,
            hash
        });
        if(!tokensRecordFile.name || !tokensRecordFile.contentType) {
            throw badRequest("File has been forgotten");
        }

        const file = collectionItem.getFile(hash);
        const tempFilePath = TokensRecordController.tempFilePath({ collectionLocId, recordId, hash });
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

        await this.tokensRecordService.update(collectionLocId, recordId, async item => {
            const file = item.getFile(hash);
            file.addDeliveredFile({ deliveredFileHash, generatedOn, owner });
        });

        downloadAndClean({
            response: this.response,
            path: tempFilePath,
            name: tokensRecordFile.name,
            contentType: tokensRecordFile.contentType,
        });
    }

    private async checkCanDownloadTokensRecordFile(authenticated: AuthenticatedUser, collectionLocId: string, recordId: Hash, hash: Hash, itemId: Hash): Promise<TokensRecordAggregateRoot> {
        const item = await this.collectionRepository.findBy(collectionLocId, itemId);
        if(!item) {
            throw badRequest(`Collection item ${ collectionLocId } not found on-chain`);
        }
        const token = item.getDescription().token;

        const tokensRecord = await this.getTokensRecordWithFile(collectionLocId, recordId, hash);

        if(!token || ! await this.ownershipCheckService.isOwner(authenticated.address, token)) {
            throw forbidden(`${authenticated.address} does not seem to be the owner of related item's underlying token`);
        } else {
            return tokensRecord;
        }
    }

    private async getTokensRecordWithFile(collectionLocId: string, recordId: Hash, hash: Hash): Promise<TokensRecordAggregateRoot> {
        const tokensRecord = requireDefined(
            await this.tokensRecordRepository.findBy(collectionLocId, recordId),
            () => badRequest(`Tokens Record ${ collectionLocId }/${ recordId.toHex() } not found in DB`));
        if (!tokensRecord.hasFile(hash)) {
            throw badRequest("File does not exist");
        }
        const file = tokensRecord.getFile(hash);
        if (!file.cid) {
            throw badRequest("Trying to download a file that is not uploaded yet.");
        }
        return tokensRecord;
    }

    static tempFilePath(params: { collectionLocId: string, recordId: Hash, hash: Hash } ) {
        const { collectionLocId, recordId, hash } = params;
        return path.join(os.tmpdir(), `download-${ collectionLocId }-${ recordId.toHex() }-${ hash.toHex() }`);
    }

    private async getItemDeliveries(query: { collectionLocId: string, recordId: Hash, fileHash?: Hash, limitPerFile?: number }): Promise<ItemDeliveriesResponse> {
        const { collectionLocId, recordId, fileHash, limitPerFile } = query;
        const delivered = await this.tokensRecordRepository.findLatestDeliveries({ collectionLocId, recordId, fileHash });
        if(!delivered) {
            throw badRequest("Original file not found or it was never delivered yet");
        } else {
            return this.mapTokensRecordFilesDelivered(delivered, limitPerFile);
        }
    }

    private async mapTokensRecordFilesDelivered(delivered: Record<string, TokensRecordFileDelivered[]>, limitPerFile?: number): Promise<ItemDeliveriesResponse> {
        const owners = new Set<string>();
        for(const fileHash of Object.keys(delivered)) {
            const owner = delivered[fileHash][0].owner; // Only check latest owners
            if(owner) {
                owners.add(owner);
            }
        }

        const view: ItemDeliveriesResponse = {};
        for(const fileHash of Object.keys(delivered)) {
            view[fileHash] = delivered[fileHash].slice(0, limitPerFile).map(delivery => this.mapTokensRecordFileDelivered(delivery));
        }
        return view;
    }

    private mapTokensRecordFileDelivered(delivered: TokensRecordFileDelivered): CheckLatestItemDeliveryResponse {
        return {
            copyHash: delivered.deliveredFileHash,
            generatedOn: moment(delivered.generatedOn).toISOString(),
            owner: delivered.owner,
        }
    }

    static getAllItemDeliveries(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/records/{collectionLocId}/{recordIdHex}/deliveries"].get!;
        operationObject.summary = "Provides information about all delivered copies of a collection file";
        operationObject.description = "Only collection LOC owner is authorized";
        operationObject.responses = getDefaultResponses("ItemDeliveriesResponse");
        setPathParameters(operationObject, {
            'collectionLocId': "The ID of the Collection LOC",
            'recordIdHex': "The ID of the Collection Item",
        });
    }

    @HttpGet('/:collectionLocId/:recordIdHex/deliveries')
    @Async()
    async getAllItemDeliveries(_body: never, collectionLocId: string, recordIdHex: string): Promise<ItemDeliveriesResponse> {
        const collectionLoc = requireDefined(await this.locRequestRepository.findById(collectionLocId),
            () => badRequest(`Collection ${ collectionLocId } not found`));
        await this.locAuthorizationService.ensureContributor(this.request, collectionLoc);

        const recordId = Hash.fromHex(recordIdHex);
        return this.getItemDeliveries({ collectionLocId, recordId });
    }

    static downloadFileSource(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/records/{collectionLocId}/{recordIdHex}/files-sources/{hashHex}"].get!;
        operationObject.summary = "Downloads the source of a file of the Collection Item";
        operationObject.description = "The authenticated user must be the owner or the requester of the LOC";
        operationObject.responses = getDefaultResponsesWithAnyBody();
        setPathParameters(operationObject, {
            'collectionLocId': "The ID of the Collection LOC",
            'recordIdHex': "The ID of the Collection Item",
            'hashHex': "The hash of the file",
        });
    }

    @HttpGet('/:collectionLocId/:recordIdHex/files-sources/:hashHex')
    @Async()
    @SendsResponse()
    async downloadFileSource(_body: never, collectionLocId: string, recordIdHex: string, hashHex: string): Promise<void> {
        const collectionLoc = requireDefined(await this.locRequestRepository.findById(collectionLocId),
            () => badRequest("Collection LOC not found"));
        await this.locAuthorizationService.ensureContributor(this.request, collectionLoc);

        const recordId = Hash.fromHex(recordIdHex);
        const hash = Hash.fromHex(hashHex);
        const tokensRecordFile = await this.getTokensRecordFile({
            collectionLocId,
            recordId,
            hash
        });
        if(!tokensRecordFile.name || !tokensRecordFile.contentType) {
            throw badRequest("File has been forgotten");
        }

        const tokensRecord = await this.getTokensRecordWithFile(collectionLocId, recordId, hash);
        const file = tokensRecord.getFile(hash);
        const tempFilePath = TokensRecordController.tempFilePath({ collectionLocId, recordId, hash });
        await this.fileStorageService.exportFile(file, tempFilePath);

        downloadAndClean({
            response: this.response,
            path: tempFilePath,
            name: tokensRecordFile.name,
            contentType: tokensRecordFile.contentType,
        });
    }

    static checkOneFileDelivery(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/records/{collectionLocId}/{recordIdHex}/deliveries/check"].put!;
        operationObject.summary = "Provides information about one delivered collection file copy";
        operationObject.description = "This is a public resource";
        operationObject.requestBody = getRequestBody({
            description: "Candidate Delivered File Hash",
            view: "CheckCollectionDeliveryRequest"});
        operationObject.responses = getPublicResponses("CheckCollectionDeliveryWitheOriginalResponse");
        setPathParameters(operationObject, {
            'collectionLocId': "The ID of the Collection LOC",
            'recordIdHex': "The ID of the record",
        });
    }

    @HttpPut('/:collectionLocId/:recordIdHex/deliveries/check')
    @Async()
    async checkOneFileDelivery(body: CheckCollectionDeliveryRequest, collectionLocId: string, recordIdHex: string): Promise<CheckCollectionDeliveryWitheOriginalResponse> {
        const deliveredFileHash = Hash.fromHex(requireDefined(body.copyHash, () => badRequest("Missing attribute copyHash")));
        const recordId = Hash.fromHex(recordIdHex);
        const delivery = await this.tokensRecordRepository.findDeliveryByDeliveredFileHash({
            collectionLocId,
            recordId,
            deliveredFileHash
        });
        if (delivery === null) {
            throw badRequest("Provided copyHash is not from a delivered copy of a file from the record");
        }
        return {
            ...this.mapToResponse(delivery),
            originalFileHash: delivery.hash
        };
    }

    private mapToResponse(deliveredCopy: TokensRecordFileDelivered): CheckCollectionDeliveryResponse {
        return {
            copyHash: deliveredCopy.deliveredFileHash,
            owner: deliveredCopy.owner,
            generatedOn: moment(deliveredCopy.generatedOn).toISOString(),
        }
    }
}
