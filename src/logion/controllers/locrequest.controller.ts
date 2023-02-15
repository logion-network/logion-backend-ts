import { injectable } from "inversify";
import { Controller, ApiController, HttpPost, Async, HttpPut, HttpGet, SendsResponse, HttpDelete } from "dinoloop";
import { OpenAPIV3 } from "express-oas-generator";
import { v4 as uuid } from "uuid";
import moment from "moment";

import { components } from "./components.js";
import {
    LocRequestRepository,
    LocRequestFactory,
    LocRequestDescription,
    LocRequestAggregateRoot,
    FetchLocRequestsSpecification,
    LocRequestDecision,
    FileDescription
} from "../model/locrequest.model.js";
import {
    getRequestBody,
    getDefaultResponses,
    addTag,
    setControllerTag,
    getDefaultResponsesNoContent,
    setPathParameters,
    getDefaultResponsesWithAnyBody,
    Log,
    badRequest,
    requireDefined,
    requireLength,
    AuthenticationService,
    forbidden,
    PolkadotService,
} from "@logion/rest-api-core";
import { UUID, getVerifiedIssuers } from "@logion/node-api";

import { UserIdentity } from "../model/useridentity.js";
import { FileStorageService } from "../services/file.storage.service.js";
import { ForbiddenException } from "dinoloop/modules/builtin/exceptions/exceptions.js";
import { NotificationService, Template, NotificationRecipient } from "../services/notification.service.js";
import { DirectoryService } from "../services/directory.service.js";
import { CollectionRepository } from "../model/collection.model.js";
import { getUploadedFile } from "./fileupload.js";
import { PostalAddress } from "../model/postaladdress.js";
import { downloadAndClean } from "../lib/http.js";
import { LocRequestAdapter } from "./adapters/locrequestadapter.js";
import { LocRequestService } from "../services/locrequest.service.js";
import { VoteRepository } from "../model/vote.model.js";
import { AuthenticatedUser } from "@logion/authenticator";

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
    LocRequestController.createSofRequest(spec);
    LocRequestController.submitLocRequest(spec);
    LocRequestController.cancelLocRequest(spec);
    LocRequestController.reworkLocRequest(spec);
}

type CreateLocRequestView = components["schemas"]["CreateLocRequestView"];
type LocRequestView = components["schemas"]["LocRequestView"];
type LocPublicView = components["schemas"]["LocPublicView"];
type FetchLocRequestsSpecificationView = components["schemas"]["FetchLocRequestsSpecificationView"];
type FetchLocRequestsResponseView = components["schemas"]["FetchLocRequestsResponseView"];
type RejectLocRequestView = components["schemas"]["RejectLocRequestView"];
type UserIdentityView = components["schemas"]["UserIdentityView"];
type PostalAddressView = components["schemas"]["PostalAddressView"];
type VoidLocView = components["schemas"]["VoidLocView"];
type AddFileView = components["schemas"]["AddFileView"];
type AddLinkView = components["schemas"]["AddLinkView"];
type AddMetadataView = components["schemas"]["AddMetadataView"];
type CreateSofRequestView = components["schemas"]["CreateSofRequestView"];

@injectable()
@Controller('/loc-request')
export class LocRequestController extends ApiController {

    constructor(
        private locRequestRepository: LocRequestRepository,
        private locRequestFactory: LocRequestFactory,
        private authenticationService: AuthenticationService,
        private collectionRepository: CollectionRepository,
        private fileStorageService: FileStorageService,
        private notificationService: NotificationService,
        private directoryService: DirectoryService,
        private locRequestAdapter: LocRequestAdapter,
        private locRequestService: LocRequestService,
        private voteRepository: VoteRepository,
        private polkadotService: PolkadotService,
    ) {
        super();
    }

    static createLocRequest(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request"].post!;
        operationObject.summary = "Creates a new LOC Request";
        operationObject.description = "The authenticated user must be either the requester or a legal officer operating on node";
        operationObject.requestBody = getRequestBody({
            description: "LOC Request creation data",
            view: "CreateLocRequestView",
        });
        operationObject.responses = getDefaultResponses("LocRequestView");
    }

    @HttpPost('')
    @Async()
    async createLocRequest(createLocRequestView: CreateLocRequestView): Promise<LocRequestView> {
        const authenticatedUser = await this.authenticationService.authenticatedUser(this.request);
        authenticatedUser.require(user => user.isOneOf([ createLocRequestView.requesterAddress, createLocRequestView.ownerAddress ]));
        const ownerAddress = await this.directoryService.requireLegalOfficerAddressOnNode(createLocRequestView.ownerAddress);
        const locType = requireDefined(createLocRequestView.locType);
        const description: LocRequestDescription = {
            requesterAddress: createLocRequestView.requesterAddress,
            requesterIdentityLoc: createLocRequestView.requesterIdentityLoc,
            ownerAddress,
            description: requireDefined(createLocRequestView.description),
            locType,
            createdOn: moment().toISOString(),
            userIdentity: locType === "Identity" ? this.fromUserIdentityView(createLocRequestView.userIdentity) : undefined,
            userPostalAddress: locType === "Identity" ? this.fromUserPostalAddressView(createLocRequestView.userPostalAddress) : undefined,
            company: createLocRequestView.company,
        }
        if (locType === "Identity") {
            if ((await this.existsValidPolkadotIdentityLoc(description.requesterAddress, ownerAddress))) {
                throw badRequest("Only one Polkadot Identity LOC is allowed per Legal Officer.");
            }
        } else {
            if (!(await this.existsValidPolkadotIdentityLoc(description.requesterAddress, ownerAddress)) &&
                !(await this.existsValidLogionIdentityLoc(description.requesterIdentityLoc))) {
                throw badRequest("Unable to find a valid (closed) identity LOC.");
            }
        }
        let request: LocRequestAggregateRoot;
        if (authenticatedUser.address === ownerAddress) {
            request = await this.locRequestFactory.newLOLocRequest({
                id: uuid(),
                description,
            });
        } else {
            request = await this.locRequestFactory.newLocRequest({
                id: uuid(),
                description,
                draft: createLocRequestView.draft === true,
            });
        }
        await this.locRequestService.addNewRequest(request);
        const { userIdentity, userPostalAddress, identityLocId } = await this.locRequestAdapter.findUserPrivateData(request);
        if (request.status === "REQUESTED" && authenticatedUser.address !== ownerAddress) {
            this.notify("LegalOfficer", "loc-requested", request.getDescription(), userIdentity)
        }
        return this.locRequestAdapter.toView(request, authenticatedUser.address, { userIdentity, userPostalAddress, identityLocId });
    }

    private async existsValidPolkadotIdentityLoc(requesterAddress: string | undefined, ownerAddress: string): Promise<boolean> {
        if (requesterAddress === undefined) {
            return false;
        }
        const identityLoc = (await this.locRequestRepository.findBy({
            expectedLocTypes: [ "Identity" ],
            expectedIdentityLocType: "Polkadot",
            expectedRequesterAddress: requesterAddress,
            expectedOwnerAddress: ownerAddress,
            expectedStatuses: [ "CLOSED" ]
        })).find(loc => loc.getVoidInfo() === null);
        return identityLoc !== undefined;
    }

    private async existsValidLogionIdentityLoc(identityLocId:string | undefined): Promise<boolean> {
        if (!identityLocId) {
            return false;
        }
        const identityLoc = await this.locRequestRepository.findById(identityLocId);
        return identityLoc !== null &&
            identityLoc.locType === 'Identity' &&
            identityLoc.status === 'CLOSED' &&
            identityLoc.getVoidInfo() === null &&
            !identityLoc.requesterAddress;
    }

    private fromUserIdentityView(userIdentityView: UserIdentityView | undefined): UserIdentity | undefined {
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

    private fromUserPostalAddressView(userPostalAddressView: PostalAddressView | undefined): PostalAddress | undefined {
        if (userPostalAddressView === undefined) {
            return undefined;
        }
        return {
            line1: userPostalAddressView.line1 || "",
            line2: userPostalAddressView.line2 || "",
            postalCode: userPostalAddressView.postalCode || "",
            city: userPostalAddressView.city || "",
            country: userPostalAddressView.country || "",
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
        const authenticatedUser = await this.authenticationService.authenticatedUser(this.request);
        authenticatedUser.require(authenticatedUser => authenticatedUser.isOneOf([ specificationView.requesterAddress, specificationView.ownerAddress ]));
        const specification: FetchLocRequestsSpecification = {
            expectedRequesterAddress: specificationView.requesterAddress,
            expectedOwnerAddress: specificationView.ownerAddress,
            expectedStatuses: requireDefined(specificationView.statuses),
            expectedLocTypes: specificationView.locTypes,
            expectedIdentityLocType: specificationView.identityLocType
        }
        const requests = Promise.all((await this.locRequestRepository.findBy(specification)).map(async request => {
            const userPrivateData = await this.locRequestAdapter.findUserPrivateData(request);
            return this.locRequestAdapter.toView(request, authenticatedUser.address, userPrivateData);
        }));
        return requests.then(requestViews => Promise.resolve({requests: requestViews}))
    }

    static getLocRequest(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/{requestId}"].get!;
        operationObject.summary = "Gets a single LOC Request";
        operationObject.description = "The authenticated user must be either expected requester or expected owner.";
        operationObject.responses = getDefaultResponses("LocRequestView");
        setPathParameters(operationObject, { 'requestId': "The ID of the LOC request" })
    }

    @HttpGet('/:requestId')
    @Async()
    async getLocRequest(_body: any, requestId: string): Promise<LocRequestView> {
        try {
            const request = requireDefined(await this.locRequestRepository.findById(requestId));
            const { contributor } = await this.ensureContributorOrVoter(request);
            return this.locRequestAdapter.toView(request, contributor);
        } catch (e) {
            logger.error(e);
            throw e;
        }
    }

    private async ensureContributorOrVoter(request: LocRequestAggregateRoot): Promise<{ contributor: string, voter: boolean} > {
        const authenticatedUser = await this.authenticationService.authenticatedUser(this.request);
        if (await this.isContributor(request, authenticatedUser)) {
            return {
                contributor: authenticatedUser.address,
                voter: false
            }
        } else if (await this.isVoterOnLoc(request, authenticatedUser)) {
            return {
                contributor: authenticatedUser.address,
                voter: true
            }
        } else {
            throw forbidden("Authenticated user is not allowed to view the content of this LOC");
        }
    }

    private async ensureContributor(request: LocRequestAggregateRoot): Promise<string> {
        const authenticatedUser = await this.authenticationService.authenticatedUser(this.request);
        if (await this.isContributor(request, authenticatedUser)) {
            return authenticatedUser.address;
        } else {
            throw forbidden("Authenticated user is not allowed to contribute to this LOC");
        }
    }

    private async isContributor(request: LocRequestAggregateRoot, authenticatedUser: AuthenticatedUser): Promise<boolean> {
        const contributor = authenticatedUser.address;
        return (
            request.ownerAddress === contributor ||
            request.requesterAddress === contributor ||
            await this.isSelectedThirdParty(request, contributor)
        );
    }

    private async isVoterOnLoc(request: LocRequestAggregateRoot, authenticatedUser: AuthenticatedUser): Promise<boolean> {
        return (
            await authenticatedUser.isLegalOfficer() &&
            await this.voteRepository.findByLocId(request.id!) !== null
        );
    }

    private async isSelectedThirdParty(request: LocRequestAggregateRoot, submitter: string): Promise<boolean> {
        const api = await this.polkadotService.readyApi();
        const issuers = await getVerifiedIssuers(api, new UUID(request.id));
        const selectedParticipant = issuers.find(issuer => issuer.address === submitter);
        return selectedParticipant !== undefined;
    }

    static getPublicLoc(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/{requestId}/public"].get!;
        operationObject.summary = "Gets the published attributes of a single LOC";
        operationObject.description = "No authentication required.";
        operationObject.responses = getDefaultResponses("LocPublicView");
        setPathParameters(operationObject, { 'requestId': "The ID of the LOC request" })
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
            files: request.getFiles().map(file => ({
                hash: file.hash,
                nature: file.nature,
                addedOn: file.addedOn?.toISOString() || undefined,
                submitter: file.submitter,
                restrictedDelivery: file.restrictedDelivery,
                contentType: file.contentType,
            })),
            metadata: request.getMetadataItems().map(item => ({
                name: item.name,
                value: item.value,
                addedOn: item.addedOn?.toISOString() || undefined,
                submitter: item.submitter,
            })),
            links: request.getLinks().map(link => ({
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
        setPathParameters(operationObject, { 'requestId': "The ID of the LOC request to reject" });
    }

    @HttpPost('/:requestId/reject')
    @Async()
    async rejectLocRequest(rejectLocRequestView: RejectLocRequestView, requestId: string) {
        const authenticatedUser = await this.authenticationService.authenticatedUserIsLegalOfficerOnNode(this.request);
        const request = await this.locRequestService.update(requestId, async request => {
            authenticatedUser.require(user => user.is(request.ownerAddress));
            request.reject(rejectLocRequestView.rejectReason!, moment());
        });
        const { userIdentity } = await this.locRequestAdapter.findUserPrivateData(request);
        this.notify("WalletUser", "loc-rejected", request.getDescription(), userIdentity, request.getDecision());
    }

    static acceptLocRequest(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/{requestId}/accept"].post!;
        operationObject.summary = "Accepts a LOC Request";
        operationObject.description = "The authenticated user must be the owner of the LOC.";
        operationObject.responses = getDefaultResponsesNoContent();
        setPathParameters(operationObject, { 'requestId': "The ID of the LOC request to reject" });
    }

    @HttpPost('/:requestId/accept')
    @Async()
    async acceptLocRequest(_ignoredBody: any, requestId: string) {
        const authenticatedUser = await this.authenticationService.authenticatedUserIsLegalOfficerOnNode(this.request);
        const request = await this.locRequestService.update(requestId, async request => {
            authenticatedUser.require(user => user.is(request.ownerAddress));
            request.accept(moment());
        });
        const { userIdentity } = await this.locRequestAdapter.findUserPrivateData(request);
        this.notify("WalletUser", "loc-accepted", request.getDescription(), userIdentity, request.getDecision());
    }

    static submitLocRequest(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/{requestId}/submit"].post!;
        operationObject.summary = "Submits a draft LOC Request";
        operationObject.description = "The authenticated user must be the requester of the LOC.";
        operationObject.responses = getDefaultResponsesNoContent();
        setPathParameters(operationObject, { 'requestId': "The ID of the draft LOC request to submit" });
    }

    @HttpPost('/:requestId/submit')
    @Async()
    async submitLocRequest(_ignoredBody: any, requestId: string) {
        const authenticatedUser = await this.authenticationService.authenticatedUser(this.request);
        const request = await this.locRequestService.update(requestId, async request => {
            authenticatedUser.require(user => user.is(request.requesterAddress));
            request.submit();
        });
        const { userIdentity } = await this.locRequestAdapter.findUserPrivateData(request);
        this.notify("LegalOfficer", "loc-requested", request.getDescription(), userIdentity);
    }

    static cancelLocRequest(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/{requestId}/cancel"].post!;
        operationObject.summary = "Cancels a draft or rejected LOC Request";
        operationObject.description = "The authenticated user must be the requester of the LOC.";
        operationObject.responses = getDefaultResponsesNoContent();
        setPathParameters(operationObject, { 'requestId': "The ID of the draft LOC request to submit" });
    }

    @HttpPost('/:requestId/cancel')
    @Async()
    async cancelLocRequest(_ignoredBody: any, requestId: string) {
        const authenticatedUser = await this.authenticationService.authenticatedUser(this.request);
        const request = await this.locRequestService.deleteDraftOrRejected(requestId, async request => {
            authenticatedUser.require(user => user.is(request.requesterAddress));
        });
        for(const file of request.files || []) {
            this.fileStorageService.deleteFile(file);
        }
    }

    static reworkLocRequest(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/{requestId}/rework"].post!;
        operationObject.summary = "Convert back a rejected LOC Request to draft";
        operationObject.description = "The authenticated user must be the requester of the LOC.";
        operationObject.responses = getDefaultResponsesNoContent();
        setPathParameters(operationObject, { 'requestId': "The ID of the reject LOC request to move back to draft" });
    }

    @HttpPost('/:requestId/rework')
    @Async()
    async reworkLocRequest(_ignoredBody: any, requestId: string) {
        const authenticatedUser = await this.authenticationService.authenticatedUser(this.request);
        await this.locRequestService.update(requestId, async request => {
            authenticatedUser.require(user => user.is(request.requesterAddress));
            request.rework();
        });
    }

    static addFile(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/{requestId}/files"].post!;
        operationObject.summary = "Adds a file to the LOC";
        operationObject.description = "The authenticated user must be the owner of the LOC.";
        operationObject.responses = getDefaultResponsesNoContent();
        setPathParameters(operationObject, { 'requestId': "The ID of the LOC" });
    }

    @HttpPost('/:requestId/files')
    @Async()
    async addFile(addFileView: AddFileView, requestId: string): Promise<void> {
        const request = requireDefined(await this.locRequestRepository.findById(requestId));
        const contributor = await this.ensureContributor(request);

        const hash = requireDefined(addFileView.hash, () => badRequest("No hash found for upload file"));
        if(request.hasFile(hash)) {
            throw new Error("File already present");
        }
        const file = await getUploadedFile(this.request, hash);
        const cid = await this.fileStorageService.importFile(file.tempFilePath);

        try {
            await this.locRequestService.update(requestId, async request => {
                request.addFile({
                    name: file.name,
                    contentType: file.mimetype,
                    hash,
                    cid,
                    nature: addFileView.nature || "",
                    submitter: contributor,
                    restrictedDelivery: addFileView.restrictedDelivery || false,
                    size: file.size,
                });
            });
        } catch(e) {
            await this.fileStorageService.deleteFile({ cid });
        }
    }

    static downloadFile(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/{requestId}/files/{hash}"].get!;
        operationObject.summary = "Downloads a file of the LOC";
        operationObject.description = "The authenticated user must be contributor or voter of the LOC.";
        operationObject.responses = getDefaultResponsesWithAnyBody();
        setPathParameters(operationObject, {
            'requestId': "The ID of the LOC",
            'hash': "The hash of the file to download"
        });
    }

    @HttpGet('/:requestId/files/:hash')
    @Async()
    @SendsResponse()
    async downloadFile(_body: any, requestId: string, hash: string): Promise<void> {
        const request = requireDefined(await this.locRequestRepository.findById(requestId));
        const { contributor, voter } = await this.ensureContributorOrVoter(request);

        const file = request.getFile(hash);
        if(contributor !== request.ownerAddress && contributor !== request.requesterAddress && file.submitter !== contributor && !voter) {
            throw forbidden("Authenticated user is not allowed to download this file");
        }

        const tempFilePath = "/tmp/download-" + requestId + "-" + hash;
        await this.fileStorageService.exportFile(file, tempFilePath);
        downloadAndClean({
            response: this.response,
            path: tempFilePath,
            name: file.name,
            contentType: file.contentType,
        });
    }

    static deleteFile(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/{requestId}/files/{hash}"].delete!;
        operationObject.summary = "Deletes a file of the LOC";
        operationObject.description = "The authenticated user must be the owner of the LOC. The file's hash must not yet have been published in the blockchain.";
        operationObject.responses = getDefaultResponsesWithAnyBody();
        setPathParameters(operationObject, {
            'requestId': "The ID of the LOC",
            'hash': "The hash of the file to download"
        });
    }

    @HttpDelete('/:requestId/files/:hash')
    @Async()
    async deleteFile(_body: any, requestId: string, hash: string): Promise<void> {
        let file: FileDescription | undefined;
        await this.locRequestService.update(requestId, async request => {
            const contributor = await this.ensureContributor(request);
            file = request.removeFile(contributor, hash);
        });
        if(file) {
            await this.fileStorageService.deleteFile(file);
        }
    }

    static confirmFile(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/{requestId}/files/{hash}/confirm"].put!;
        operationObject.summary = "Confirms a file of the LOC";
        operationObject.description = "The authenticated user must be the owner of the LOC. Once a file is confirmed, it cannot be deleted anymore.";
        operationObject.responses = getDefaultResponsesNoContent();
        setPathParameters(operationObject, {
            'requestId': "The ID of the LOC",
            'hash': "The hash of the file to download"
        });
    }

    @HttpPut('/:requestId/files/:hash/confirm')
    @Async()
    @SendsResponse()
    async confirmFile(_body: any, requestId: string, hash: string) {
        const authenticatedUser = await this.authenticationService.authenticatedUserIsLegalOfficerOnNode(this.request);
        await this.locRequestService.update(requestId, async request => {
            authenticatedUser.require(user => user.is(request.ownerAddress));
            request.confirmFile(hash);
        });
        this.response.sendStatus(204);
    }

    static closeLoc(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/{requestId}/close"].post!;
        operationObject.summary = "Closes a LOC";
        operationObject.description = "The authenticated user must be the owner of the LOC.";
        operationObject.responses = getDefaultResponsesNoContent();
        setPathParameters(operationObject, { 'requestId': "The ID of the LOC" });
    }

    @HttpPost('/:requestId/close')
    @Async()
    @SendsResponse()
    async closeLoc(_body: any, requestId: string) {
        const authenticatedUser = await this.authenticationService.authenticatedUserIsLegalOfficerOnNode(this.request);
        await this.locRequestService.update(requestId, async request => {
            authenticatedUser.require(user => user.is(request.ownerAddress));
            request.preClose();
        });
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
        setPathParameters(operationObject, { 'requestId': "The ID of the LOC" });
    }

    @HttpPost('/:requestId/void')
    @Async()
    @SendsResponse()
    async voidLoc(body: VoidLocView, requestId: string) {
        const authenticatedUser = await this.authenticationService.authenticatedUserIsLegalOfficerOnNode(this.request);
        await this.locRequestService.update(requestId, async request => {
            authenticatedUser.require(user => user.is(request.ownerAddress));
            request.preVoid(body.reason!);
        });
        this.response.sendStatus(204);
    }

    static addLink(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/{requestId}/links"].post!;
        operationObject.summary = "Adds a link to the LOC";
        operationObject.description = "The authenticated user must be the owner of the LOC.";
        operationObject.responses = getDefaultResponsesNoContent();
        setPathParameters(operationObject, { 'requestId': "The ID of the LOC" });
    }

    @HttpPost('/:requestId/links')
    @Async()
    @SendsResponse()
    async addLink(addLinkView: AddLinkView, requestId: string): Promise<void> {
        const authenticatedUser = await this.authenticationService.authenticatedUser(this.request);
        const targetRequest = requireDefined(await this.locRequestRepository.findById(addLinkView.target!));
        await this.locRequestService.update(requestId, async request => {
            authenticatedUser.require(user => user.is(request.ownerAddress));
            request.addLink({
                target: targetRequest.id!,
                nature: addLinkView.nature || ""
            });
        });
        this.response.sendStatus(204);
    }

    static deleteLink(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/{requestId}/links/{target}"].delete!;
        operationObject.summary = "Deletes a link of the LOC";
        operationObject.description = "The authenticated user must be the owner of the LOC. The link must not yet have been published in the blockchain.";
        operationObject.responses = getDefaultResponsesWithAnyBody();
        setPathParameters(operationObject, {
            'requestId': "The ID of the LOC",
            'target': "The ID of the linked LOC"
        });
    }

    @HttpDelete('/:requestId/links/:target')
    @Async()
    async deleteLink(_body: any, requestId: string, target: string): Promise<void> {
        const userCheck = await this.authenticationService.authenticatedUser(this.request);
        await this.locRequestService.update(requestId, async request => {
            userCheck.require(user => user.is(request.ownerAddress));
            request.removeLink(userCheck.address, target);
        });
    }

    static confirmLink(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/{requestId}/links/{target}/confirm"].put!;
        operationObject.summary = "Confirms a link of the LOC";
        operationObject.description = "The authenticated user must be the owner of the LOC. Once a link is confirmed, it cannot be deleted anymore.";
        operationObject.responses = getDefaultResponsesNoContent();
        setPathParameters(operationObject, {
            'requestId': "The ID of the LOC",
            'target': "The target of the link"
        });
    }

    @HttpPut('/:requestId/links/:target/confirm')
    @Async()
    @SendsResponse()
    async confirmLink(_body: any, requestId: string, target: string) {
        const authenticatedUser = await this.authenticationService.authenticatedUserIsLegalOfficerOnNode(this.request);
        await this.locRequestService.update(requestId, async request => {
            authenticatedUser.require(user => user.is(request.ownerAddress));
            request.confirmLink(target);
        });
        this.response.sendStatus(204);
    }

    static addMetadata(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/{requestId}/metadata"].post!;
        operationObject.summary = "Adds a Metadata item to the LOC";
        operationObject.description = "The authenticated user must be the owner of the LOC.";
        operationObject.responses = getDefaultResponsesNoContent();
        setPathParameters(operationObject, { 'requestId': "The ID of the LOC" });
    }

    @HttpPost('/:requestId/metadata')
    @Async()
    @SendsResponse()
    async addMetadata(addMetadataView: AddMetadataView, requestId: string): Promise<void> {
        const name = requireLength(addMetadataView, "name", 3, 255);
        const value = requireLength(addMetadataView, "value", 1, 4096);
        await this.locRequestService.update(requestId, async request => {
            const contributor = await this.ensureContributor(request);
            request.addMetadataItem({ name, value, submitter: contributor });
        });
        this.response.sendStatus(204);
    }

    static deleteMetadata(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/{requestId}/metadata/{name}"].delete!;
        operationObject.summary = "Deletes a metadata item of the LOC";
        operationObject.description = "The authenticated user must be the owner of the LOC. The metadata item must not yet have been published in the blockchain.";
        operationObject.responses = getDefaultResponsesWithAnyBody();
        setPathParameters(operationObject, {
            'requestId': "The ID of the LOC",
            'name': "The name of the metadata item"
        });
    }

    @HttpDelete('/:requestId/metadata/:name')
    @Async()
    async deleteMetadata(_body: any, requestId: string, name: string): Promise<void> {
        const decodedName = decodeURIComponent(name);
        await this.locRequestService.update(requestId, async request => {
            const contributor = await this.ensureContributor(request);
            request.removeMetadataItem(contributor, decodedName);
        });
    }

    static confirmMetadata(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/{requestId}/metadata/{name}/confirm"].put!;
        operationObject.summary = "Confirms a metadata item of the LOC";
        operationObject.description = "The authenticated user must be the owner of the LOC. Once a metadata item is confirmed, it cannot be deleted anymore.";
        operationObject.responses = getDefaultResponsesNoContent();
        setPathParameters(operationObject, {
            'requestId': "The ID of the LOC",
            'name': "The name of the metadata"
        });
    }

    @HttpPut('/:requestId/metadata/:name/confirm')
    @Async()
    @SendsResponse()
    async confirmMetadata(_body: any, requestId: string, name: string) {
        const authenticatedUser = await this.authenticationService.authenticatedUserIsLegalOfficerOnNode(this.request);
        const decodedName = decodeURIComponent(name);
        await this.locRequestService.update(requestId, async request => {
            authenticatedUser.require(user => user.is(request.ownerAddress));
            request.confirmMetadataItem(decodedName);
        });
        this.response.sendStatus(204);
    }

    static createSofRequest(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/sof"].post!;
        operationObject.summary = "Request a LOC aimed at containing a Statement of Fact";
        operationObject.description = "The authenticated user must be the owner of the LOC.";
        operationObject.requestBody = getRequestBody({
            description: "Sof Request creation data",
            view: "CreateSofRequestView",
        });
        operationObject.responses = getDefaultResponses("LocRequestView");
    }

    @HttpPost('/sof')
    @Async()
    async createSofRequest(createSofRequestView: CreateSofRequestView): Promise<LocRequestView> {
        const locId = requireDefined(createSofRequestView.locId,
            () => badRequest("Missing locId"));
        const loc = requireDefined(await this.locRequestRepository.findById(locId),
            () => badRequest("LOC not found"));
        const contributor = await this.ensureContributor(loc);

        let description = `Statement of Facts for LOC ${ new UUID(locId).toDecimalString() }`;
        let linkNature = `Original LOC`;
        if (loc.locType === 'Collection') {
            const itemId = requireDefined(createSofRequestView.itemId,
                () => badRequest("Missing itemId"));
            requireDefined(await this.collectionRepository.findBy(locId, itemId),
                () => badRequest("Item not found"));
            description = `${ description } - ${ itemId }`
            linkNature = `${ linkNature } - Collection Item: ${ itemId }`
        }

        const requestDescription: LocRequestDescription = {
            requesterAddress: contributor,
            ownerAddress: loc.ownerAddress!,
            description,
            locType: 'Transaction',
            createdOn: moment().toISOString(),
            userIdentity: undefined,
            userPostalAddress: undefined,
        }
        let request: LocRequestAggregateRoot = await this.locRequestFactory.newSofRequest({
            id: uuid(),
            description: requestDescription,
            target: locId,
            nature: linkNature,
        });
        await this.locRequestService.addNewRequest(request);

        const { userIdentity, userPostalAddress, identityLocId } = requireDefined(await this.locRequestAdapter.findUserPrivateData(request))

        this.notify("LegalOfficer", "sof-requested", request.getDescription(), userIdentity);

        return this.locRequestAdapter.toView(request, contributor, { userIdentity, userPostalAddress, identityLocId });
    }

    private notify(recipient: NotificationRecipient, templateId: Template, loc: LocRequestDescription, userIdentity?: UserIdentity, decision?: LocRequestDecision): void {
        if (!userIdentity) {
            return
        }
        this.getNotificationInfo(loc, userIdentity, decision)
            .then(info => {
                const to = recipient === "WalletUser" ? userIdentity.email : info.legalOfficerEMail
                return this.notificationService.notify(to, templateId, info.data)
                    .catch(reason => logger.warn("Failed to send email '%s' to %s : %s", templateId, to, reason))
            })
            .catch(reason =>
                logger.warn("Failed to retrieve notification info from directory: %s. Mail '%' not sent.", reason, templateId)
            )
    }

    private async getNotificationInfo(loc: LocRequestDescription, userIdentity: UserIdentity, decision?: LocRequestDecision):
        Promise<{ legalOfficerEMail: string, data: any }> {

        const legalOfficer = await this.directoryService.get(loc.ownerAddress);
        return {
            legalOfficerEMail: legalOfficer.userIdentity.email,
            data: {
                loc: { ...loc, decision },
                legalOfficer,
                walletUser: userIdentity,
            }
        }
    }
}
