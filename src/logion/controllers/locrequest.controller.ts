import { injectable } from "inversify";
import { Controller, ApiController, HttpPost, Async, HttpPut, HttpGet, SendsResponse, HttpDelete } from "dinoloop";
import fileUpload from 'express-fileupload';
import { OpenAPIV3 } from "express-oas-generator";
import { v4 as uuid } from "uuid";
import moment from "moment";
import { rm } from 'fs/promises';

import { components } from "./components";
import {
    LocRequestRepository,
    LocRequestFactory,
    LocRequestDescription,
    LocRequestAggregateRoot,
    FetchLocRequestsSpecification
} from "../model/locrequest.model";
import {
    getRequestBody,
    getDefaultResponses,
    addTag,
    setControllerTag,
    getDefaultResponsesNoContent,
    addPathParameter,
    getDefaultResponsesWithAnyBody
} from "./doc";
import { AuthenticationService } from "../services/authentication.service";
import { requireDefined, requireLength } from "../lib/assertions";
import { UserIdentity } from "../model/useridentity";
import { ProtectionRequestRepository, FetchProtectionRequestsSpecification } from "../model/protectionrequest.model";
import { sha256File } from "../lib/crypto/hashing";
import { FileDbService } from "../services/filedb.service";
import { Log } from "../util/Log";
import { ForbiddenException } from "dinoloop/modules/builtin/exceptions/exceptions";

const { logger } = Log;

export function fillInSpec(spec: OpenAPIV3.Document): void {
    const tagName = 'LOC Requests';
    addTag(spec, {
        name: tagName,
        description: "Handling of LOC Requests"
    });
    setControllerTag(spec, /^\/api\/loc-request.*/, tagName);

    LocRequestController.createLocRequest(spec);
    LocRequestController.fetchRequests(spec);
    LocRequestController.getLocRequest(spec);
    LocRequestController.getPublicLoc(spec);
    LocRequestController.rejectLocRequest(spec);
    LocRequestController.acceptLocRequest(spec);
    LocRequestController.addFile(spec);
    LocRequestController.downloadFile(spec);
    LocRequestController.deleteFile(spec);
    LocRequestController.confirmFile(spec);
    LocRequestController.closeLoc(spec);
    LocRequestController.voidLoc(spec);
    LocRequestController.addLink(spec);
    LocRequestController.deleteLink(spec);
    LocRequestController.confirmLink(spec);
    LocRequestController.addMetadata(spec);
    LocRequestController.deleteMetadata(spec);
    LocRequestController.confirmMetadata(spec);
}

type CreateLocRequestView = components["schemas"]["CreateLocRequestView"];
type LocRequestView = components["schemas"]["LocRequestView"];
type LocPublicView = components["schemas"]["LocPublicView"];
type FetchLocRequestsSpecificationView = components["schemas"]["FetchLocRequestsSpecificationView"];
type FetchLocRequestsResponseView = components["schemas"]["FetchLocRequestsResponseView"];
type RejectLocRequestView = components["schemas"]["RejectLocRequestView"];
type UserIdentityView = components["schemas"]["UserIdentityView"];
type AddFileResultView = components["schemas"]["AddFileResultView"];
type VoidLocView = components["schemas"]["VoidLocView"];
type AddFileView = components["schemas"]["AddFileView"];
type AddLinkView = components["schemas"]["AddLinkView"];
type AddMetadataView = components["schemas"]["AddMetadataView"];

@injectable()
@Controller('/loc-request')
export class LocRequestController extends ApiController {

    constructor(
        private locRequestRepository: LocRequestRepository,
        private locRequestFactory: LocRequestFactory,
        private authenticationService: AuthenticationService,
        private protectionRequestRepository: ProtectionRequestRepository,
        private fileDbService: FileDbService) {
        super();
    }

    static createLocRequest(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request"].post!;
        operationObject.summary = "Creates a new LOC Request";
        operationObject.description = "The authenticated user must be either the requester or the owner";
        operationObject.requestBody = getRequestBody({
            description: "LOC Request creation data",
            view: "CreateLocRequestView",
        });
        operationObject.responses = getDefaultResponses("LocRequestView");
    }

    @HttpPost('')
    @Async()
    async createLocRequest(createLocRequestView: CreateLocRequestView): Promise<LocRequestView> {
        const authenticatedUser = this.authenticationService.authenticatedUser(this.request);
        authenticatedUser.require(user => user.is(createLocRequestView.requesterAddress) || user.isNodeOwner());
        const description: LocRequestDescription = {
            requesterAddress: createLocRequestView.requesterAddress,
            requesterIdentityLoc: createLocRequestView.requesterIdentityLoc,
            ownerAddress: this.authenticationService.nodeOwner,
            description: requireDefined(createLocRequestView.description),
            locType: requireDefined(createLocRequestView.locType),
            createdOn: moment().toISOString(),
            userIdentity: this.fromUserView(createLocRequestView.userIdentity)
        }
        let request: LocRequestAggregateRoot;
        if (authenticatedUser.isNodeOwner()) {
            request = this.locRequestFactory.newOpenLoc({
                id: uuid(),
                description,
            });
        } else {
            request = this.locRequestFactory.newLocRequest({
                id: uuid(),
                description
            });
        }
        await this.checkIdentityLoc(request.requesterIdentityLoc)
        await this.locRequestRepository.save(request);
        const userIdentity = await this.findUserIdentity(request);
        return this.toView(request, userIdentity);
    }

    private async checkIdentityLoc(identityLocId:string | undefined) {
        if (!identityLocId) {
            return
        }
        const identityLoc = await this.locRequestRepository.findById(identityLocId);
        if (
            !identityLoc ||
            identityLoc.locType !== 'Identity' ||
            identityLoc.status !== 'CLOSED' ||
            identityLoc.getVoidInfo() ||
            identityLoc.requesterAddress !== undefined) {
            throw new Error("UnexpectedRequester: Identity must be an existing Closed, not Void, Logion Identity LOC.")
        }
    }

    private toView(request: LocRequestAggregateRoot, userIdentity: UserIdentity | undefined): LocRequestView {
        const locDescription = request.getDescription();
        const view: LocRequestView = {
            id: request.id,
            requesterAddress: locDescription.requesterAddress,
            requesterIdentityLoc: locDescription.requesterIdentityLoc,
            ownerAddress: locDescription.ownerAddress,
            description: locDescription.description,
            locType: locDescription.locType,
            userIdentity: this.toUserView(userIdentity),
            createdOn: locDescription.createdOn || undefined,
            status: request.status,
            rejectReason: request.rejectReason || undefined,
            decisionOn: request.decisionOn || undefined,
            closedOn: request.closedOn || undefined,
            files: request.getFiles().map(file => ({
                name: file.name,
                hash: file.hash,
                nature: file.nature,
                addedOn: file.addedOn?.toISOString() || undefined,
            })),
            metadata: request.getMetadataItems().map(item => ({
                name: item.name,
                value: item.value,
                addedOn: item.addedOn?.toISOString() || undefined,
            })),
            links: request.getLinks().map(link => ({
                target: link.target,
                nature: link.nature,
                addedOn: link.addedOn?.toISOString() || undefined,
            }))
        };
        const voidInfo = request.getVoidInfo();
        if(voidInfo !== null) {
            view.voidInfo = {
                reason: voidInfo.reason,
                voidedOn: voidInfo.voidedOn?.toISOString()
            };
        }
        return view;
    }

    private toUserView(userIdentity: UserIdentity | undefined): UserIdentityView | undefined {
        if (userIdentity === undefined) {
            return undefined;
        }
        return {
            firstName: userIdentity.firstName,
            lastName: userIdentity.lastName,
            email: userIdentity.email,
            phoneNumber: userIdentity.phoneNumber,
        }
    }

    private fromUserView(userIdentityView: UserIdentityView | undefined): UserIdentity | undefined {
        if (userIdentityView === undefined) {
            return undefined;
        }
        return {
            firstName: userIdentityView.firstName || "",
            lastName: userIdentityView.lastName || "",
            email: userIdentityView.email || "",
            phoneNumber: userIdentityView.phoneNumber || "",
        }
    }

    static fetchRequests(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request"].put!;
        operationObject.summary = "Lists LOC Requests based on a given specification";
        operationObject.description = "The authenticated user must be either expected requester or expected owner.";
        operationObject.requestBody = getRequestBody({
            description: "The specification for fetching LOC Requests",
            view: "FetchLocRequestsSpecificationView",
        });
        operationObject.responses = getDefaultResponses("FetchLocRequestsResponseView");
    }

    @HttpPut('')
    @Async()
    async fetchRequests(specificationView: FetchLocRequestsSpecificationView): Promise<FetchLocRequestsResponseView> {
        this.authenticationService.authenticatedUserIsOneOf(this.request, specificationView.requesterAddress, specificationView.ownerAddress)
        const specification: FetchLocRequestsSpecification = {
            expectedRequesterAddress: specificationView.requesterAddress,
            expectedOwnerAddress: specificationView.ownerAddress,
            expectedStatuses: requireDefined(specificationView.statuses),
            expectedLocTypes: specificationView.locTypes,
            expectedIdentityLocType: specificationView.identityLocType
        }
        const requests = Promise.all((await this.locRequestRepository.findBy(specification)).map(async request => {
            const userIdentity = await this.findUserIdentity(request);
            return this.toView(request, userIdentity);
        }));
        return requests.then(requestViews => Promise.resolve({requests: requestViews}))
    }

    private async findUserIdentity(request: LocRequestAggregateRoot): Promise<UserIdentity | undefined> {
        const description = request.getDescription();
        if (description.requesterAddress) {
            const protections = await this.protectionRequestRepository.findBy(new FetchProtectionRequestsSpecification({
                expectedStatuses: [ "ACCEPTED", "ACTIVATED" ],
                kind: "ANY",
                expectedRequesterAddress: description.requesterAddress,
            }));
            if (protections.length > 0) {
                return protections[0].getDescription().userIdentity;
            }
        }
        if (description.requesterIdentityLoc) {
            const identityLoc = await this.locRequestRepository.findById(description.requesterIdentityLoc)
            if (identityLoc) {
                return identityLoc.getDescription().userIdentity;
            }
        }
        return request.getDescription().userIdentity;
    }

    static getLocRequest(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/{requestId}"].get!;
        operationObject.summary = "Gets a single LOC Request";
        operationObject.description = "The authenticated user must be either expected requester or expected owner.";
        operationObject.responses = getDefaultResponses("LocRequestView");
    }

    @HttpGet('/:requestId')
    @Async()
    async getLocRequest(_body: any, requestId: string): Promise<LocRequestView> {
        try {
            const request = requireDefined(await this.locRequestRepository.findById(requestId));
            this.authenticationService.authenticatedUserIsOneOf(this.request,
                request.requesterAddress, request.ownerAddress);
            const userIdentity = await this.findUserIdentity(request);
            return this.toView(request, userIdentity);
        } catch (e) {
            logger.error(e);
            throw e;
        }
    }

    static getPublicLoc(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/{requestId}/public"].get!;
        operationObject.summary = "Gets the published attributes of a single LOC";
        operationObject.description = "No authentication required.";
        operationObject.responses = getDefaultResponses("LocPublicView");
    }

    @HttpGet('/:requestId/public')
    @Async()
    async getPublicLoc(_body: any, requestId: string): Promise<LocPublicView> {
        const request = requireDefined(await this.locRequestRepository.findById(requestId));
        if (request.status === 'OPEN' || request.status === 'CLOSED') {
            return this.toPublicView(request);
        }
        throw new ForbiddenException();
    }

    private toPublicView(request: LocRequestAggregateRoot): LocPublicView {
        const locDescription = request.getDescription();
        const view: LocPublicView = {
            id: request.id,
            requesterAddress: locDescription.requesterAddress,
            ownerAddress: locDescription.ownerAddress,
            createdOn: locDescription.createdOn || undefined,
            closedOn: request.closedOn || undefined,
            files: request.getFiles(false).map(file => ({
                hash: file.hash,
                nature: file.nature,
                addedOn: file.addedOn?.toISOString() || undefined,
            })),
            metadata: request.getMetadataItems(false).map(item => ({
                name: item.name,
                value: item.value,
                addedOn: item.addedOn?.toISOString() || undefined
            })),
            links: request.getLinks(false).map(link => ({
                target: link.target,
                nature: link.nature,
                addedOn: link.addedOn?.toISOString() || undefined,
            }))
        }
        const voidInfo = request.getVoidInfo();
        if(voidInfo !== null) {
            view.voidInfo = {
                voidedOn: voidInfo.voidedOn?.toISOString()
            };
        }
        return view;
    }

    static rejectLocRequest(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/{requestId}/reject"].post!;
        operationObject.summary = "Rejects a LOC Request";
        operationObject.description = "The authenticated user must be the owner of the LOC.";
        operationObject.requestBody = getRequestBody({
            description: "The info for rejecting LOC Request",
            view: "RejectLocRequestView",
        });
        operationObject.responses = getDefaultResponsesNoContent();
        addPathParameter(operationObject, 'requestId', "The ID of the LOC request to reject");
    }

    @HttpPost('/:requestId/reject')
    @Async()
    async rejectLocRequest(rejectLocRequestView: RejectLocRequestView, requestId: string) {
        const request = requireDefined(await this.locRequestRepository.findById(requestId));
        this.authenticationService.authenticatedUser(this.request)
            .is(request.ownerAddress);
        request.reject(rejectLocRequestView.rejectReason!, moment());
        await this.locRequestRepository.save(request)
    }

    static acceptLocRequest(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/{requestId}/accept"].post!;
        operationObject.summary = "Accepts a LOC Request";
        operationObject.description = "The authenticated user must be the owner of the LOC.";
        operationObject.responses = getDefaultResponsesNoContent();
        addPathParameter(operationObject, 'requestId', "The ID of the LOC request to reject");
    }

    @HttpPost('/:requestId/accept')
    @Async()
    async acceptLocRequest(_ignoredBody: any, requestId: string) {
        const request = requireDefined(await this.locRequestRepository.findById(requestId));
        this.authenticationService.authenticatedUser(this.request)
            .is(request.ownerAddress);
        request.accept(moment());
        await this.locRequestRepository.save(request)
    }

    static addFile(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/{requestId}/files"].post!;
        operationObject.summary = "Adds a file to the LOC";
        operationObject.description = "The authenticated user must be the owner of the LOC.";
        operationObject.responses = getDefaultResponses("AddFileResultView");
        addPathParameter(operationObject, 'requestId', "The ID of the LOC");
    }

    @HttpPost('/:requestId/files')
    @Async()
    async addFile(addFileView: AddFileView, requestId: string): Promise<AddFileResultView> {
        const request = requireDefined(await this.locRequestRepository.findById(requestId));
        this.authenticationService.authenticatedUser(this.request)
            .is(request.ownerAddress);

        const files: fileUpload.FileArray = this.request.files;
        if(files === undefined || files === null) {
            throw new Error("No file detected");
        }
        const uploadedFiles: fileUpload.UploadedFile | fileUpload.UploadedFile[] = files['file'];
        let file: fileUpload.UploadedFile;
        if(uploadedFiles instanceof Array) {
            file = uploadedFiles[0];
        } else {
            file = uploadedFiles;
        }

        const hash = await sha256File(file.tempFilePath);
        if(request.hasFile(hash)) {
            throw new Error("File already present");
        }

        const oid = await this.fileDbService.importFile(file.tempFilePath, hash);
        request.addFile({
            name: file.name,
            contentType: file.mimetype,
            hash,
            oid,
            nature: addFileView.nature || ""
        });
        await this.locRequestRepository.save(request);

        return { hash };
    }

    static downloadFile(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/{requestId}/files/{hash}"].get!;
        operationObject.summary = "Downloads a file of the LOC";
        operationObject.description = "The authenticated user must be the owner of the LOC.";
        operationObject.responses = getDefaultResponsesWithAnyBody();
        addPathParameter(operationObject, 'requestId', "The ID of the LOC");
        addPathParameter(operationObject, 'hash', "The hash of the file to download");
    }

    @HttpGet('/:requestId/files/:hash')
    @Async()
    @SendsResponse()
    async downloadFile(_body: any, requestId: string, hash: string): Promise<void> {
        const request = requireDefined(await this.locRequestRepository.findById(requestId));
        this.authenticationService.authenticatedUser(this.request)
            .is(request.ownerAddress);

        const file = request.getFile(hash);
        const tempFilePath = "/tmp/download-" + requestId + "-" + hash;
        await this.fileDbService.exportFile(file.oid, tempFilePath);
        this.response.download(tempFilePath, file.name, { headers: { "content-type": file.contentType } }, (error: any) => {
            rm(tempFilePath);
            if(error) {
                logger.error("Download failed: %s", error);
            }
        });
    }

    static deleteFile(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/{requestId}/files/{hash}"].delete!;
        operationObject.summary = "Deletes a file of the LOC";
        operationObject.description = "The authenticated user must be the owner of the LOC. The file's hash must not yet have been published in the blockchain.";
        operationObject.responses = getDefaultResponsesWithAnyBody();
        addPathParameter(operationObject, 'requestId', "The ID of the LOC");
        addPathParameter(operationObject, 'hash', "The hash of the file to download");
    }

    @HttpDelete('/:requestId/files/:hash')
    @Async()
    async deleteFile(_body: any, requestId: string, hash: string): Promise<void> {
        const request = requireDefined(await this.locRequestRepository.findById(requestId));
        this.authenticationService.authenticatedUser(this.request)
            .is(request.ownerAddress);

        const file = request.removeFile(hash);
        await this.locRequestRepository.save(request);

        await this.fileDbService.deleteFile(file.oid);
    }

    static confirmFile(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/{requestId}/files/{hash}/confirm"].put!;
        operationObject.summary = "Confirms a file of the LOC";
        operationObject.description = "The authenticated user must be the owner of the LOC. Once a file is confirmed, it cannot be deleted anymore.";
        operationObject.responses = getDefaultResponsesNoContent();
        addPathParameter(operationObject, 'requestId', "The ID of the LOC");
        addPathParameter(operationObject, 'hash', "The hash of the file to download");
    }

    @HttpPut('/:requestId/files/:hash/confirm')
    @Async()
    @SendsResponse()
    async confirmFile(_body: any, requestId: string, hash: string) {
        const request = requireDefined(await this.locRequestRepository.findById(requestId));
        this.authenticationService.authenticatedUser(this.request)
            .is(request.ownerAddress);

        request.confirmFile(hash);
        await this.locRequestRepository.save(request);

        this.response.sendStatus(204);
    }

    static closeLoc(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/{requestId}/close"].post!;
        operationObject.summary = "Closes a LOC";
        operationObject.description = "The authenticated user must be the owner of the LOC.";
        operationObject.responses = getDefaultResponsesNoContent();
        addPathParameter(operationObject, 'requestId', "The ID of the LOC");
    }

    @HttpPost('/:requestId/close')
    @Async()
    @SendsResponse()
    async closeLoc(_body: any, requestId: string) {
        const request = requireDefined(await this.locRequestRepository.findById(requestId));
        this.authenticationService.authenticatedUser(this.request)
            .is(request.ownerAddress);

        request.preClose();
        await this.locRequestRepository.save(request);

        this.response.sendStatus(204);
    }

    static voidLoc(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/{requestId}/void"].post!;
        operationObject.summary = "Voids a LOC";
        operationObject.description = "The authenticated user must be the owner of the LOC.";
        operationObject.requestBody = getRequestBody({
            description: "The voiding parameters",
            view: "VoidLocView",
        });
        operationObject.responses = getDefaultResponsesNoContent();
        addPathParameter(operationObject, 'requestId', "The ID of the LOC");
    }

    @HttpPost('/:requestId/void')
    @Async()
    @SendsResponse()
    async voidLoc(body: VoidLocView, requestId: string) {
        const request = requireDefined(await this.locRequestRepository.findById(requestId));
        this.authenticationService.authenticatedUser(this.request)
            .is(request.ownerAddress);

        request.preVoid(body.reason!);
        await this.locRequestRepository.save(request);

        this.response.sendStatus(204);
    }

    static addLink(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/{requestId}/links"].post!;
        operationObject.summary = "Adds a link to the LOC";
        operationObject.description = "The authenticated user must be the owner of the LOC.";
        operationObject.responses = getDefaultResponsesNoContent();
        addPathParameter(operationObject, 'requestId', "The ID of the LOC");
    }

    @HttpPost('/:requestId/links')
    @Async()
    @SendsResponse()
    async addLink(addLinkView: AddLinkView, requestId: string): Promise<void> {
        const request = requireDefined(await this.locRequestRepository.findById(requestId));
        this.authenticationService.authenticatedUser(this.request)
            .is(request.ownerAddress);
        const targetRequest = requireDefined(await this.locRequestRepository.findById(addLinkView.target!));
        request.addLink({
            target: targetRequest.id!,
            nature: addLinkView.nature || ""
        })
        await this.locRequestRepository.save(request)
        this.response.sendStatus(204);
    }

    static deleteLink(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/{requestId}/links/{target}"].delete!;
        operationObject.summary = "Deletes a link of the LOC";
        operationObject.description = "The authenticated user must be the owner of the LOC. The link must not yet have been published in the blockchain.";
        operationObject.responses = getDefaultResponsesWithAnyBody();
        addPathParameter(operationObject, 'requestId', "The ID of the LOC");
        addPathParameter(operationObject, 'target', "The ID of the linked LOC");
    }

    @HttpDelete('/:requestId/links/:target')
    @Async()
    async deleteLink(_body: any, requestId: string, target: string): Promise<void> {
        const request = requireDefined(await this.locRequestRepository.findById(requestId));
        this.authenticationService.authenticatedUser(this.request)
            .is(request.ownerAddress);

        request.removeLink(target);
        await this.locRequestRepository.save(request);
    }

    static confirmLink(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/{requestId}/links/{target}/confirm"].put!;
        operationObject.summary = "Confirms a link of the LOC";
        operationObject.description = "The authenticated user must be the owner of the LOC. Once a link is confirmed, it cannot be deleted anymore.";
        operationObject.responses = getDefaultResponsesNoContent();
        addPathParameter(operationObject, 'requestId', "The ID of the LOC");
        addPathParameter(operationObject, 'target', "The target of the link");
    }

    @HttpPut('/:requestId/links/:target/confirm')
    @Async()
    @SendsResponse()
    async confirmLink(_body: any, requestId: string, target: string) {
        const request = requireDefined(await this.locRequestRepository.findById(requestId));
        this.authenticationService.authenticatedUser(this.request)
            .is(request.ownerAddress);

        request.confirmLink(target);
        await this.locRequestRepository.save(request);

        this.response.sendStatus(204);
    }

    static addMetadata(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/{requestId}/metadata"].post!;
        operationObject.summary = "Adds a Metadata item to the LOC";
        operationObject.description = "The authenticated user must be the owner of the LOC.";
        operationObject.responses = getDefaultResponsesNoContent();
        addPathParameter(operationObject, 'requestId', "The ID of the LOC");
    }

    @HttpPost('/:requestId/metadata')
    @Async()
    @SendsResponse()
    async addMetadata(addMetadataView: AddMetadataView, requestId: string): Promise<void> {
        const request = requireDefined(await this.locRequestRepository.findById(requestId));
        this.authenticationService.authenticatedUser(this.request)
            .is(request.ownerAddress);
        const name = requireLength(addMetadataView, "name", 3, 40)
        const value = requireLength(addMetadataView, "value", 1, 4096)
        request.addMetadataItem({ name, value })
        await this.locRequestRepository.save(request)
        this.response.sendStatus(204);
    }

    static deleteMetadata(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/{requestId}/metadata/{name}"].delete!;
        operationObject.summary = "Deletes a metadata item of the LOC";
        operationObject.description = "The authenticated user must be the owner of the LOC. The metadata item must not yet have been published in the blockchain.";
        operationObject.responses = getDefaultResponsesWithAnyBody();
        addPathParameter(operationObject, 'requestId', "The ID of the LOC");
        addPathParameter(operationObject, 'name', "The name of the metadata item");
    }

    @HttpDelete('/:requestId/metadata/:name')
    @Async()
    async deleteMetadata(_body: any, requestId: string, name: string): Promise<void> {
        const request = requireDefined(await this.locRequestRepository.findById(requestId));
        this.authenticationService.authenticatedUser(this.request)
            .is(request.ownerAddress);

        const decodedName = decodeURIComponent(name);
        request.removeMetadataItem(decodedName);
        await this.locRequestRepository.save(request);
    }

    static confirmMetadata(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/{requestId}/metadata/{name}/confirm"].put!;
        operationObject.summary = "Confirms a metadata item of the LOC";
        operationObject.description = "The authenticated user must be the owner of the LOC. Once a metadata item is confirmed, it cannot be deleted anymore.";
        operationObject.responses = getDefaultResponsesNoContent();
        addPathParameter(operationObject, 'requestId', "The ID of the LOC");
        addPathParameter(operationObject, 'name', "The name of the metadata");
    }

    @HttpPut('/:requestId/metadata/:name/confirm')
    @Async()
    @SendsResponse()
    async confirmMetadata(_body: any, requestId: string, name: string) {
        const request = requireDefined(await this.locRequestRepository.findById(requestId));
        this.authenticationService.authenticatedUser(this.request)
            .is(request.ownerAddress);

        const decodedName = decodeURIComponent(name);
        request.confirmMetadataItem(decodedName);
        await this.locRequestRepository.save(request);

        this.response.sendStatus(204);
    }
}
