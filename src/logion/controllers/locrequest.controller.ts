import { injectable } from "inversify";
import { Controller, ApiController, HttpPost, Async, HttpPut, HttpGet, SendsResponse, HttpDelete, QueryParam } from "dinoloop";
import { OpenAPIV3 } from "express-oas-generator";
import { v4 as uuid } from "uuid";
import moment from "moment";

import { components } from "./components.js";
import {
    LocRequestRepository,
    LocRequestFactory,
    LocRequestAggregateRoot,
    FetchLocRequestsSpecification,
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
    unauthorized,
} from "@logion/rest-api-core";
import { LocType, UUID, ValidAccountId } from "@logion/node-api";

import { UserIdentity } from "../model/useridentity.js";
import { FileStorageService } from "../services/file.storage.service.js";
import { ForbiddenException } from "dinoloop/modules/builtin/exceptions/exceptions.js";
import { NotificationService, Template, NotificationRecipient } from "../services/notification.service.js";
import { DirectoryService } from "../services/directory.service.js";
import { CollectionRepository } from "../model/collection.model.js";
import { getUploadedFile } from "./fileupload.js";
import { PostalAddress } from "../model/postaladdress.js";
import { downloadAndClean, toBadRequest } from "../lib/http.js";
import { LocRequestAdapter } from "./adapters/locrequestadapter.js";
import { LocRequestService } from "../services/locrequest.service.js";
import { LocAuthorizationService, Contribution } from "../services/locauthorization.service.js";
import { validAccountId } from "../model/supportedaccountid.model.js";
import { SponsorshipService } from "../services/sponsorship.service.js";
import { Hash } from "../lib/crypto/hashing.js";
import { toBigInt } from "../lib/convert.js";
import { LocalsObject } from "pug";
import { SubmissionType } from "../model/loc_lifecycle.js";
import { CollectionParams, LocRequestDecision, LocRequestDescription } from "../model/loc_vos.js";
import { LocFees } from "../model/loc_fees.js";
import { FileDescription, FileParams, LinkParams, MetadataItemParams, StoredFile } from "../model/loc_items.js";

const { logger } = Log;

export function fillInSpec(spec: OpenAPIV3.Document): void {
    const tagName = 'LOC Requests';
    addTag(spec, {
        name: tagName,
        description: "Handling of LOC Requests"
    });
    setControllerTag(spec, /^\/api\/loc-request.*/, tagName);

    LocRequestController.createLocRequest(spec);
    LocRequestController.createOpenLoc(spec);
    LocRequestController.cancelCreateOpenLoc(spec);
    LocRequestController.fetchRequests(spec);
    LocRequestController.getLocRequest(spec);
    LocRequestController.getPublicLoc(spec);
    LocRequestController.rejectLocRequest(spec);
    LocRequestController.acceptLocRequest(spec);
    LocRequestController.addFile(spec);
    LocRequestController.downloadFile(spec);
    LocRequestController.deleteFile(spec);
    LocRequestController.requestFileReview(spec);
    LocRequestController.reviewFile(spec);
    LocRequestController.prePublishOrAcknowledgeFile(spec);
    LocRequestController.cancelPrePublishOrAcknowledgeFile(spec);
    LocRequestController.preAcknowledgeFile(spec);
    LocRequestController.cancelPreAcknowledgeFile(spec);
    LocRequestController.openLoc(spec);
    LocRequestController.cancelOpenLoc(spec);
    LocRequestController.closeLoc(spec);
    LocRequestController.cancelCloseLoc(spec);
    LocRequestController.voidLoc(spec);
    LocRequestController.cancelVoidLoc(spec);
    LocRequestController.addLink(spec);
    LocRequestController.deleteLink(spec);
    LocRequestController.requestMetadataReview(spec);
    LocRequestController.reviewMetadata(spec);
    LocRequestController.requestLinkReview(spec);
    LocRequestController.reviewLink(spec);
    LocRequestController.prePublishOrAcknowledgeLink(spec);
    LocRequestController.cancelPrePublishOrAcknowledgeLink(spec);
    LocRequestController.preAcknowledgeLink(spec);
    LocRequestController.cancelPreAcknowledgeLink(spec);
    LocRequestController.addMetadata(spec);
    LocRequestController.deleteMetadata(spec);
    LocRequestController.prePublishOrAcknowledgeMetadataItem(spec);
    LocRequestController.cancelPrePublishOrAcknowledgeMetadataItem(spec);
    LocRequestController.preAcknowledgeMetadataItem(spec);
    LocRequestController.cancelPreAcknowledgeMetadataItem(spec);
    LocRequestController.createSofRequest(spec);
    LocRequestController.submitLocRequest(spec);
    LocRequestController.cancelLocRequest(spec);
    LocRequestController.reworkLocRequest(spec);
    LocRequestController.addSecret(spec);
    LocRequestController.removeSecret(spec);
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
type ReviewItemView = components["schemas"]["ReviewItemView"];
type OpenLocView = components["schemas"]["OpenLocView"];
type CloseView = components["schemas"]["CloseView"];
type OpenView = components["schemas"]["OpenView"];
type LocFeesView = components["schemas"]["LocFeesView"];
type CollectionParamsView = components["schemas"]["CollectionParamsView"];
type AddSecretView = components["schemas"]["AddSecretView"];

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
        private locAuthorizationService: LocAuthorizationService,
        private sponsorshipService: SponsorshipService,
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
        const ownerAddress = await this.directoryService.requireLegalOfficerAddressOnNode(createLocRequestView.ownerAddress);
        const locType = requireDefined(createLocRequestView.locType);
        const requesterAddress = !authenticatedUser.validAccountId.equals(ownerAddress) ?
            authenticatedUser.validAccountId :
            validAccountId(createLocRequestView.requesterAddress)
        const sponsorshipId = createLocRequestView.sponsorshipId ? new UUID(createLocRequestView.sponsorshipId) : undefined;
        if (sponsorshipId) {
            try {
                await this.sponsorshipService.validateSponsorship(sponsorshipId, ownerAddress, authenticatedUser.validAccountId);
            } catch (e) {
                throw badRequest("" + e);
            }
        }
        const requesterIdentityLoc = await this.locRequestRepository.getNonVoidIdentityLoc(requesterAddress, ownerAddress);
        if (locType === "Identity") {
            if (requesterAddress && requesterIdentityLoc) {
                throw badRequest("Only one Polkadot Identity LOC is allowed per Legal Officer.");
            }
        } else {
            if (requesterAddress && requesterAddress.type !== "Polkadot") {
                throw badRequest("Only Polkadot address can request a Transaction/Collection LOC");
            }
            if (!requesterIdentityLoc &&
                !(await this.existsValidLogionIdentityLoc(createLocRequestView.requesterIdentityLoc))) {
                throw badRequest("Unable to find a valid (closed) identity LOC.");
            }
        }
        const description: LocRequestDescription = {
            requesterAddress,
            requesterIdentityLoc: requesterIdentityLoc ? requesterIdentityLoc.id : createLocRequestView.requesterIdentityLoc,
            ownerAddress,
            description: requireDefined(createLocRequestView.description),
            locType,
            createdOn: moment().toISOString(),
            userIdentity: locType === "Identity" ? this.fromUserIdentityView(createLocRequestView.userIdentity) : undefined,
            userPostalAddress: locType === "Identity" ? this.fromUserPostalAddressView(createLocRequestView.userPostalAddress) : undefined,
            company: createLocRequestView.company,
            template: createLocRequestView.template,
            sponsorshipId,
            fees: this.toLocFees(createLocRequestView.fees, locType),
            collectionParams: this.toCollectionParams(createLocRequestView.collectionParams),
        }
        let request: LocRequestAggregateRoot;
        if (authenticatedUser.validAccountId.equals(ownerAddress)) {
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
        if (request.status === "REVIEW_PENDING") {
            this.notify("LegalOfficer", "loc-requested", request.getDescription(), userIdentity)
        }
        return this.locRequestAdapter.toView(request, authenticatedUser.validAccountId, { userIdentity, userPostalAddress, identityLocId });
    }

    private toLocFees(view: LocFeesView | undefined, locType: LocType): LocFees {
        const valueFee = toBigInt(view?.valueFee);
        if (valueFee === undefined && locType === "Collection") {
            throw badRequest("Value fee must be set for collection LOCs");
        }
        const collectionItemFee = toBigInt(view?.collectionItemFee);
        if (collectionItemFee === undefined && locType === "Collection") {
            throw badRequest("Collection item fee must be set for collection LOCs");
        }
        const tokensRecordFee = toBigInt(view?.tokensRecordFee);
        if (tokensRecordFee === undefined && locType === "Collection") {
            throw badRequest("Tokens record fee must be set for collection LOCs");
        }
        const legalFee = toBigInt(view?.legalFee);
        return {
            valueFee,
            legalFee,
            collectionItemFee,
            tokensRecordFee,
        };
    }

    private toCollectionParams(view: CollectionParamsView | undefined): CollectionParams | undefined {
        if (view === undefined) {
            return undefined;
        } else {
            return {
                lastBlockSubmission: view.lastBlockSubmission === undefined ? undefined : BigInt(view.lastBlockSubmission),
                maxSize: view.maxSize,
                canUpload: view.canUpload !== undefined && view.canUpload
            }
        }
    }

    static createOpenLoc(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/open"].post!;
        operationObject.summary = "Creates a new LOC";
        operationObject.description = "The authenticated user must be either the requester";
        operationObject.requestBody = getRequestBody({
            description: "LOC creation data",
            view: "OpenLocView",
        });
        operationObject.responses = getDefaultResponses("LocRequestView");
    }

    @HttpPost("/open")
    @Async()
    async createOpenLoc(openLocView: OpenLocView): Promise<LocRequestView> {
        const authenticatedUser = await this.authenticationService.authenticatedUser(this.request);
        const ownerAddress = await this.directoryService.requireLegalOfficerAddressOnNode(openLocView.ownerAddress);
        const locType = requireDefined(openLocView.locType);
        const requesterAddress = authenticatedUser.validAccountId;
        const requesterIdentityLoc = await this.locRequestRepository.getValidPolkadotIdentityLoc(requesterAddress, ownerAddress);
        if (requesterIdentityLoc && locType === "Identity") {
            throw badRequest("Only one Polkadot Identity LOC is allowed per Legal Officer.");
        }
        if (!requesterIdentityLoc && locType !== "Identity") {
            throw badRequest("Unable to find a valid (closed) identity LOC.");
        }
        const description: LocRequestDescription = {
            requesterAddress,
            requesterIdentityLoc: requesterIdentityLoc?.id,
            ownerAddress,
            description: requireDefined(openLocView.description),
            locType,
            createdOn: moment().toISOString(),
            userIdentity: locType === "Identity" ? this.fromUserIdentityView(openLocView.userIdentity) : undefined,
            userPostalAddress: locType === "Identity" ? this.fromUserPostalAddressView(openLocView.userPostalAddress) : undefined,
            company: openLocView.company,
            template: openLocView.template,
            fees: this.toLocFees(openLocView.fees, locType),
            collectionParams: this.toCollectionParams(openLocView.collectionParams),
        }
        const metadata = openLocView.metadata?.map(item => this.toMetadata(item, requesterAddress));
        const links = openLocView.links ?
            await Promise.all(openLocView.links.map(item => this.toLink(item, requesterAddress))) :
            undefined;

        const request = await this.locRequestFactory.newLoc({
            id: uuid(),
            description,
            metadata,
            links,
        })
        await this.locRequestService.addNewRequest(request);
        return this.locRequestAdapter.toView(request, authenticatedUser.validAccountId);
    }

    private async existsValidLogionIdentityLoc(identityLocId:string | undefined): Promise<boolean> {
        if (!identityLocId) {
            return false;
        }
        const identityLoc = await this.locRequestRepository.findById(identityLocId);
        return identityLoc !== null && identityLoc !== undefined &&
            identityLoc.locType === 'Identity' &&
            identityLoc.status === 'CLOSED' &&
            identityLoc.getVoidInfo() === null &&
            identityLoc.getRequester() === undefined;
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

    static cancelCreateOpenLoc(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/open/{requestId}"].delete!;
        operationObject.summary = "Cancels new open LOC";
        operationObject.description = "The authenticated user must be either the requester";
        operationObject.responses = getDefaultResponsesNoContent();
    }

    @HttpDelete("/open/:requestId")
    @Async()
    @SendsResponse()
    async cancelCreateOpenLoc(requestId: string) {
        const authenticatedUser = await this.authenticationService.authenticatedUser(this.request);
        const request = await this.locRequestRepository.findById(requestId);
        if(request && request.id) {
            if(!request.isRequester(authenticatedUser.validAccountId)) {
                throw unauthorized("Only requester can cancel request");
            }
            await this.locRequestService.deleteOpen(request.id);
        }
        this.response.sendStatus(204);
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
        const requester = specificationView.requesterAddress ? ValidAccountId.polkadot(specificationView.requesterAddress) : undefined;
        const owner = specificationView.ownerAddress ? ValidAccountId.polkadot(specificationView.ownerAddress) : undefined;
        authenticatedUser.require(authenticatedUser => authenticatedUser.isOneOf([ requester, owner ]));
        const specification: FetchLocRequestsSpecification = {
            expectedRequesterAddress: requester,
            expectedOwnerAddress: owner ? [ owner ] : undefined,
            expectedStatuses: requireDefined(specificationView.statuses),
            expectedLocTypes: specificationView.locTypes,
            expectedIdentityLocType: specificationView.identityLocType,
            expectedSponsorshipId: specificationView.sponsorshipId ? new UUID(specificationView.sponsorshipId) : undefined,
        }
        const requests = Promise.all((await this.locRequestRepository.findBy(specification)).map(async request => {
            const userPrivateData = await this.locRequestAdapter.findUserPrivateData(request);
            return this.locRequestAdapter.toView(request, authenticatedUser.validAccountId, userPrivateData);
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
    async getLocRequest(_body: never, requestId: string): Promise<LocRequestView> {
        try {
            const request = requireDefined(await this.locRequestRepository.findById(requestId));
            const { contributor } = await this.ensureContributorOrVoter(request);
            return this.locRequestAdapter.toView(request, contributor);
        } catch (e) {
            logger.error(e);
            throw e;
        }
    }

    private async ensureContributorOrVoter(request: LocRequestAggregateRoot): Promise<{ contributor: ValidAccountId, voter: boolean} > {
        const authenticatedUser = await this.authenticationService.authenticatedUser(this.request);
        const contributor = authenticatedUser.validAccountId;
        if (await this.locAuthorizationService.isContributor(Contribution.locContribution(this.request, request), contributor)) {
            return {
                contributor,
                voter: false
            }
        } else if (await this.locAuthorizationService.isVoterOnLoc(request, authenticatedUser)) {
            return {
                contributor,
                voter: true
            }
        } else {
            throw forbidden("Authenticated user is not allowed to view the content of this LOC");
        }
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
    async getPublicLoc(_body: never, requestId: string): Promise<LocPublicView> {
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
            requesterAddress: this.locRequestAdapter.toSupportedAccountId(locDescription.requesterAddress),
            ownerAddress: locDescription.ownerAddress.address,
            createdOn: locDescription.createdOn || undefined,
            status: request.status,
            closedOn: request.closedOn || undefined,
            files: request.getFiles().map(file => ({
                hash: file.hash.toHex(),
                nature: file.nature,
                addedOn: file.addedOn?.toISOString() || undefined,
                submitter: this.locRequestAdapter.toSupportedAccountId(file.submitter),
                restrictedDelivery: file.restrictedDelivery,
                contentType: file.contentType,
            })),
            metadata: request.getMetadataItems().map(item => ({
                name: item.name,
                nameHash: item.nameHash.toHex(),
                value: item.value,
                addedOn: item.addedOn?.toISOString() || undefined,
                submitter: this.locRequestAdapter.toSupportedAccountId(item.submitter),
            })),
            links: request.getLinks().map(link => ({
                target: link.target,
                nature: link.nature,
                addedOn: link.addedOn?.toISOString() || undefined,
                submitter: this.locRequestAdapter.toSupportedAccountId(link.submitter),
            })),
            template: locDescription.template,
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
            authenticatedUser.require(user => user.is(request.getOwner()));
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
    async acceptLocRequest(body: OpenView, requestId: string) {
        const authenticatedUser = await this.authenticationService.authenticatedUserIsLegalOfficerOnNode(this.request);
        const request = await this.locRequestService.update(requestId, async request => {
            authenticatedUser.require(user => user.is(request.getOwner()));
            request.accept(moment());
            if (!request.canOpen(request.getRequester())) {
                request.preOpen(body.autoPublish || false);
            }
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
    async submitLocRequest(_ignoredBody: never, requestId: string) {
        const authenticatedUser = await this.authenticationService.authenticatedUser(this.request);
        const request = await this.locRequestService.update(requestId, async request => {
            authenticatedUser.require(user => user.is(request.getRequester()));
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
    async cancelLocRequest(_ignoredBody: never, requestId: string) {
        const authenticatedUser = await this.authenticationService.authenticatedUser(this.request);
        const request = await this.locRequestService.deleteDraftRejectedOrAccepted(requestId, async request => {
            authenticatedUser.require(user => user.is(request.getRequester()));
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
    async reworkLocRequest(_ignoredBody: never, requestId: string) {
        const authenticatedUser = await this.authenticationService.authenticatedUser(this.request);
        await this.locRequestService.update(requestId, async request => {
            authenticatedUser.require(user => user.is(request.getRequester()));
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
        const contributor = await this.locAuthorizationService.ensureContributor(Contribution.itemContribution(this.request, request));
        const hash = Hash.fromHex(requireDefined(addFileView.hash, () => badRequest("No hash found for upload file")));
        if(request.hasFile(hash)) {
            throw new Error("File already present");
        }
        const file = await getUploadedFile(this.request, hash);
        const cid = await this.fileStorageService.importFile(file.tempFilePath);
        try {
            const storedFile: StoredFile = {
                name: file.name,
                size: file.size,
                contentType: file.mimetype,
                cid
            }
            const fileParams = this.toFile(addFileView, contributor, storedFile)
            await this.locRequestService.update(requestId, async request => {
                let submissionType: SubmissionType;
                if (contributor.equals(request.getRequester()) && addFileView.direct === "true") {
                    submissionType = "DIRECT_BY_REQUESTER";
                } else {
                    submissionType = contributor.equals(request.getOwner()) ? "MANUAL_BY_OWNER" : "MANUAL_BY_USER";
                }
                request.addFile(fileParams, submissionType);
            });
        } catch(e) {
            await this.fileStorageService.deleteFile({ cid });
            throw e;
        }
    }

    toFile(addFileView: AddFileView, submitter: ValidAccountId, storedFile?: StoredFile): FileParams {
        const hash = Hash.fromHex(requireDefined(addFileView.hash, () => badRequest("No hash found for upload file")));
        const file = storedFile ? storedFile : {
            name: "not-yet-uploaded",
            size: 0,
        };
        return {
            hash,
            nature: addFileView.nature || "",
            submitter,
            restrictedDelivery: addFileView.restrictedDelivery || false,
            ...file,
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
    async downloadFile(_body: never, requestId: string, hash: string): Promise<void> {
        const request = requireDefined(await this.locRequestRepository.findById(requestId));
        const { contributor, voter } = await this.ensureContributorOrVoter(request);

        const file = request.getFile(Hash.fromHex(hash));
        if(!file.contentType) {
            throw badRequest("File has been forgotten");
        }
        if (
            !contributor.equals(request.getOwner()) &&
            !contributor.equals(request.getRequester()) &&
            !contributor.equals(file.submitter) &&
            !voter) {
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
    async deleteFile(_body: never, requestId: string, hash: string): Promise<void> {
        let file: FileDescription | undefined;
        await this.locRequestService.update(requestId, async request => {
            const contributor = await this.locAuthorizationService.ensureContributor(Contribution.itemContribution(this.request, request));
            file = request.removeFile(contributor, Hash.fromHex(hash));
        });
        if(file) {
            await this.fileStorageService.deleteFile(file);
        }
    }

    static requestFileReview(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/{requestId}/files/{hash}/review-request"].post!;
        operationObject.summary = "Requests a review of the given file";
        operationObject.description = "The authenticated user must be contributor of the LOC.";
        operationObject.responses = getDefaultResponsesWithAnyBody();
        setPathParameters(operationObject, {
            'requestId': "The ID of the LOC",
            'hash': "The hash of the file to review"
        });
    }

    @HttpPost('/:requestId/files/:hash/review-request')
    @Async()
    @SendsResponse()
    async requestFileReview(_body: never, requestId: string, hash: string) {
        const request = await this.locRequestService.update(requestId, async request => {
            if (request.status !== 'OPEN') {
                throw badRequest("LOC must be OPEN for requesting item review");
            }
            await this.locAuthorizationService.ensureContributor(Contribution.itemContribution(this.request, request));
            request.requestFileReview(Hash.fromHex(hash));
        });

        const { userIdentity } = await this.locRequestAdapter.findUserPrivateData(request);
        this.notify("LegalOfficer", "review-requested", request.getDescription(), userIdentity);

        this.response.sendStatus(204);
    }

    static reviewFile(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/{requestId}/files/{hashHex}/review"].post!;
        operationObject.summary = "Reviews the given file";
        operationObject.description = "The authenticated user must be the owner of the LOC.";
        operationObject.requestBody = getRequestBody({
            description: "Accept/Reject with reason",
            view: "ReviewItemView",
        });
        operationObject.responses = getDefaultResponsesNoContent();
        setPathParameters(operationObject, {
            'requestId': "The ID of the LOC",
            'hashHex': "The hash of the file to review"
        });
    }

    @HttpPost('/:requestId/files/:hashHex/review')
    @Async()
    @SendsResponse()
    async reviewFile(view: ReviewItemView, requestId: string, hashHex: string) {
        const authenticatedUser = await this.authenticationService.authenticatedUser(this.request);
        const hash = Hash.fromHex(hashHex);
        const request = await this.locRequestService.update(requestId, async request => {
            authenticatedUser.require(user => user.is(request.getOwner()));
            if (view.decision === "ACCEPT") {
                request.acceptFile(hash);
            } else {
                const reason = requireDefined(view.rejectReason, () => badRequest("Reason is required"));
                request.rejectFile(hash, reason);
            }
        });

        if(request.status !== "REVIEW_PENDING") {
            const { userIdentity } = await this.locRequestAdapter.findUserPrivateData(request);
            this.notify("WalletUser", "data-reviewed", request.getDescription(), userIdentity);
        }

        this.response.sendStatus(204);
    }

    static prePublishOrAcknowledgeFile(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/{requestId}/files/{hashHex}/pre-publish-ack"].put!;
        operationObject.summary = "Confirms a file of the LOC";
        operationObject.description = "The authenticated user must be the owner of the LOC. Once a file is confirmed, it cannot be deleted anymore.";
        operationObject.responses = getDefaultResponsesNoContent();
        setPathParameters(operationObject, {
            'requestId': "The ID of the LOC",
            'hashHex': "The hash of the file to download"
        });
    }

    @HttpPut('/:requestId/files/:hashHex/pre-publish-ack')
    @Async()
    @SendsResponse()
    async prePublishOrAcknowledgeFile(_body: never, requestId: string, hashHex: string) {
        const hash = Hash.fromHex(hashHex);
        await this.locRequestService.update(requestId, async request => {
            const contributor = await this.locAuthorizationService.ensureContributor(Contribution.locContribution(this.request, request));
            if(request.canPrePublishOrAcknowledgeFile(hash, contributor)) {
                request.prePublishOrAcknowledgeFile(hash, contributor);
            } else {
                throw unauthorized("Contributor cannot confirm");
            }
        });
        this.response.sendStatus(204);
    }

    static cancelPrePublishOrAcknowledgeFile(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/{requestId}/files/{hashHex}/pre-publish-ack"].delete!;
        operationObject.summary = "Cancels a file publication";
        operationObject.description = "The authenticated user must be the owner of the LOC. Once a file is confirmed, it cannot be deleted anymore.";
        operationObject.responses = getDefaultResponsesNoContent();
        setPathParameters(operationObject, {
            'requestId': "The ID of the LOC",
            'hashHex': "The hash of the file to download"
        });
    }

    @HttpDelete('/:requestId/files/:hashHex/pre-publish-ack')
    @Async()
    @SendsResponse()
    async cancelPrePublishOrAcknowledgeFile(_body: never, requestId: string, hashHex: string) {
        const hash = Hash.fromHex(hashHex);
        await this.locRequestService.update(requestId, async request => {
            const contributor = await this.locAuthorizationService.ensureContributor(Contribution.locContribution(this.request, request));
            if(request.canPrePublishOrAcknowledgeFile(hash, contributor)) {
                request.cancelPrePublishOrAcknowledgeFile(hash, contributor);
            } else {
                throw unauthorized("Contributor cannot cancel");
            }
        });
        this.response.sendStatus(204);
    }

    static preAcknowledgeFile(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/{requestId}/files/{hashHex}/pre-publish-ack"].put!;
        operationObject.summary = "Confirms a file as acknowledged";
        operationObject.description = "The authenticated user must be the owner or the submitter";
        operationObject.responses = getDefaultResponsesNoContent();
        setPathParameters(operationObject, {
            'requestId': "The ID of the LOC",
            'hashHex': "The hash of the file to download"
        });
    }

    @HttpPut('/:requestId/files/:hashHex/pre-ack')
    @Async()
    @SendsResponse()
    async preAcknowledgeFile(_body: never, requestId: string, hashHex: string) {
        const hash = Hash.fromHex(hashHex);
        await this.locRequestService.update(requestId, async request => {
            const contributor = await this.locAuthorizationService.ensureContributor(Contribution.locContribution(this.request, request));
            if(!request.canPreAcknowledgeFile(hash, contributor)) {
                throw unauthorized("Only owner or Verified Issuer are allowed to acknowledge");
            } else {
                request.preAcknowledgeFile(hash, contributor);
            }
        });
        this.response.sendStatus(204);
    }

    static cancelPreAcknowledgeFile(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/{requestId}/files/{hashHex}/pre-publish-ack"].delete!;
        operationObject.summary = "Cancels a file acknowledgment";
        operationObject.description = "The authenticated user must be the owner or the submitter";
        operationObject.responses = getDefaultResponsesNoContent();
        setPathParameters(operationObject, {
            'requestId': "The ID of the LOC",
            'hashHex': "The hash of the file to download"
        });
    }

    @HttpDelete('/:requestId/files/:hashHex/pre-ack')
    @Async()
    @SendsResponse()
    async cancelPreAcknowledgeFile(_body: never, requestId: string, hashHex: string) {
        const hash = Hash.fromHex(hashHex);
        await this.locRequestService.update(requestId, async request => {
            const contributor = await this.locAuthorizationService.ensureContributor(Contribution.locContribution(this.request, request));
            if(!request.canPreAcknowledgeFile(hash, contributor)) {
                throw unauthorized("Only owner or Verified Issuer are allowed to acknowledge");
            } else {
                request.cancelPreAcknowledgeFile(hash, contributor);
            }
        });
        this.response.sendStatus(204);
    }

    static openLoc(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/{requestId}/open"].post!;
        operationObject.summary = "Opens a LOC";
        operationObject.description = "The authenticated user must be the Polkadot requester of the LOC.";
        operationObject.responses = getDefaultResponsesNoContent();
        setPathParameters(operationObject, { 'requestId': "The ID of the LOC" });
    }

    @HttpPost('/:requestId/open')
    @Async()
    @SendsResponse()
    async openLoc(body: OpenView, requestId: string) {
        const authenticatedUser = await this.authenticationService.authenticatedUser(this.request);
        await this.locRequestService.update(requestId, async request => {
            authenticatedUser.require(user => request.canOpen(user.validAccountId), "LOC must be opened by Polkadot requester");
            request.preOpen(body.autoPublish || false);
        });
        this.response.sendStatus(204);
    }

    static cancelOpenLoc(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/{requestId}/open"].delete!;
        operationObject.summary = "Cancels LOC opening";
        operationObject.description = "The authenticated user must be the Polkadot requester of the LOC.";
        operationObject.responses = getDefaultResponsesNoContent();
        setPathParameters(operationObject, { 'requestId': "The ID of the LOC" });
    }

    @HttpDelete('/:requestId/open')
    @Async()
    @SendsResponse()
    async cancelOpenLoc(_body: never, requestId: string, @QueryParam() autoPublish: string) {
        const authenticatedUser = await this.authenticationService.authenticatedUser(this.request);
        await this.locRequestService.update(requestId, async request => {
            authenticatedUser.require(user => request.canOpen(user.validAccountId), "LOC must be opened by Polkadot requester");
            request.cancelPreOpen(autoPublish === "true" || false);
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
    async closeLoc(body: CloseView, requestId: string) {
        const authenticatedUser = await this.authenticationService.authenticatedUserIsLegalOfficerOnNode(this.request);
        await this.locRequestService.update(requestId, async request => {
            authenticatedUser.require(user => user.is(request.getOwner()));
            try {
                request.preClose(body.autoAck || false);
            } catch(e) {
                throw toBadRequest(e);
            }
        });
        this.response.sendStatus(204);
    }

    static cancelCloseLoc(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/{requestId}/close"].delete!;
        operationObject.summary = "Cancels LOC closing";
        operationObject.description = "The authenticated user must be the owner of the LOC.";
        operationObject.responses = getDefaultResponsesNoContent();
        setPathParameters(operationObject, { 'requestId': "The ID of the LOC" });
    }

    @HttpDelete('/:requestId/close')
    @Async()
    @SendsResponse()
    async cancelCloseLoc(_body: never, requestId: string, @QueryParam() autoAck: string) {
        const authenticatedUser = await this.authenticationService.authenticatedUserIsLegalOfficerOnNode(this.request);
        await this.locRequestService.update(requestId, async request => {
            authenticatedUser.require(user => user.is(request.getOwner()));
            request.cancelPreClose(autoAck === "true");
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
            authenticatedUser.require(user => user.is(request.getOwner()));
            request.preVoid(body.reason || "");
        });
        this.response.sendStatus(204);
    }

    static cancelVoidLoc(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/{requestId}/void"].delete!;
        operationObject.summary = "Cancels LOC voiding";
        operationObject.description = "The authenticated user must be the owner of the LOC.";
        operationObject.responses = getDefaultResponsesNoContent();
        setPathParameters(operationObject, { 'requestId': "The ID of the LOC" });
    }

    @HttpDelete('/:requestId/void')
    @Async()
    @SendsResponse()
    async cancelVoidLoc(_body: never, requestId: string) {
        const authenticatedUser = await this.authenticationService.authenticatedUserIsLegalOfficerOnNode(this.request);
        await this.locRequestService.update(requestId, async request => {
            authenticatedUser.require(user => user.is(request.getOwner()));
            request.cancelPreVoid();
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
        await this.locRequestService.update(requestId, async request => {
            const contributor = await this.locAuthorizationService.ensureContributor(Contribution.itemContribution(this.request, request));
            const linkParams = await this.toLink(addLinkView, contributor);
            const submissionType = contributor.equals(request.getOwner()) ? "MANUAL_BY_OWNER" : "MANUAL_BY_USER";
            request.addLink(linkParams, submissionType);
        });
        this.response.sendStatus(204);
    }

    async toLink(addLinkView: AddLinkView, submitter: ValidAccountId): Promise<LinkParams> {
        // Note: this check (LOC exists in local backend) is stricter than the one done on-chain (LOC exists on chain)
        const targetRequest = requireDefined(await this.locRequestRepository.findById(addLinkView.target!));
        return {
            target: targetRequest.id!,
            nature: addLinkView.nature || "",
            submitter,
        }
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
    async deleteLink(_body: never, requestId: string, target: string): Promise<void> {
        await this.locRequestService.update(requestId, async request => {
            const contributor = await this.locAuthorizationService.ensureContributor(Contribution.itemContribution(this.request, request));
            request.removeLink(contributor, target);
        });
    }

    static requestLinkReview(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/{requestId}/links/{target}/review-request"].post!;
        operationObject.summary = "Requests a review of the given link";
        operationObject.description = "The authenticated user must be contributor of the LOC.";
        operationObject.responses = getDefaultResponsesWithAnyBody();
        setPathParameters(operationObject, {
            'requestId': "The ID of the LOC",
            'target': "The item's name hash"
        });
    }

    @HttpPost('/:requestId/links/:target/review-request')
    @Async()
    @SendsResponse()
    async requestLinkReview(_body: never, requestId: string, target: string) {
        const request = await this.locRequestService.update(requestId, async request => {
            if (request.status !== 'OPEN') {
                throw badRequest("LOC must be OPEN for requesting item review");
            }
            await this.locAuthorizationService.ensureContributor(Contribution.itemContribution(this.request, request));
            request.requestLinkReview(target);
        });

        const { userIdentity } = await this.locRequestAdapter.findUserPrivateData(request);
        this.notify("LegalOfficer", "review-requested", request.getDescription(), userIdentity);

        this.response.sendStatus(204);
    }

    static reviewLink(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/{requestId}/links/{target}/review"].post!;
        operationObject.summary = "Reviews the given link";
        operationObject.description = "The authenticated user must be the owner of the LOC.";
        operationObject.requestBody = getRequestBody({
            description: "Accept/Reject with reason",
            view: "ReviewItemView",
        });
        operationObject.responses = getDefaultResponsesNoContent();
        setPathParameters(operationObject, {
            'requestId': "The ID of the LOC",
            'target': "The item's name hash"
        });
    }

    @HttpPost('/:requestId/links/:target/review')
    @Async()
    @SendsResponse()
    async reviewLink(view: ReviewItemView, requestId: string, target: string) {
        const authenticatedUser = await this.authenticationService.authenticatedUser(this.request);
        const request = await this.locRequestService.update(requestId, async request => {
            authenticatedUser.require(user => user.is(request.getOwner()));
            if (view.decision === "ACCEPT") {
                request.acceptLink(target);
            } else {
                const reason = requireDefined(view.rejectReason, () => badRequest("Reason is required"));
                request.rejectLink(target, reason);
            }
        });

        if(request.status !== "REVIEW_PENDING") {
            const { userIdentity } = await this.locRequestAdapter.findUserPrivateData(request);
            this.notify("WalletUser", "data-reviewed", request.getDescription(), userIdentity);
        }

        this.response.sendStatus(204);
    }

    static prePublishOrAcknowledgeLink(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/{requestId}/links/{target}/pre-publish-ack"].put!;
        operationObject.summary = "Confirms a link of the LOC";
        operationObject.description = "The authenticated user must be the owner of the LOC. Once a link is confirmed, it cannot be deleted anymore.";
        operationObject.responses = getDefaultResponsesNoContent();
        setPathParameters(operationObject, {
            'requestId': "The ID of the LOC",
            'target': "The target of the link"
        });
    }

    @HttpPut('/:requestId/links/:target/pre-publish-ack')
    @Async()
    @SendsResponse()
    async prePublishOrAcknowledgeLink(_body: never, requestId: string, target: string) {
        await this.locRequestService.update(requestId, async request => {
            const contributor = await this.locAuthorizationService.ensureContributor(Contribution.locContribution(this.request, request));
            if (request.canPrePublishOrAcknowledgeLink(target, contributor)) {
                request.prePublishOrAcknowledgeLink(target, contributor);
            } else {
                throw unauthorized("Contributor cannot confirm");
            }
        });
        this.response.sendStatus(204);
    }

    static cancelPrePublishOrAcknowledgeLink(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/{requestId}/links/{target}/pre-publish-ack"].delete!;
        operationObject.summary = "Cancels a link publication";
        operationObject.description = "The authenticated user must be the owner of the LOC. Once a link is confirmed, it cannot be deleted anymore.";
        operationObject.responses = getDefaultResponsesNoContent();
        setPathParameters(operationObject, {
            'requestId': "The ID of the LOC",
            'target': "The target of the link"
        });
    }

    @HttpDelete('/:requestId/links/:target/pre-publish-ack')
    @Async()
    @SendsResponse()
    async cancelPrePublishOrAcknowledgeLink(_body: never, requestId: string, target: string) {
        await this.locRequestService.update(requestId, async request => {
            const contributor = await this.locAuthorizationService.ensureContributor(Contribution.locContribution(this.request, request));
            if (request.canPrePublishOrAcknowledgeLink(target, contributor)) {
                request.cancelPrePublishOrAcknowledgeLink(target, contributor);
            } else {
                throw unauthorized("Contributor cannot cancel");
            }
        });
        this.response.sendStatus(204);
    }

    static preAcknowledgeLink(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/{requestId}/links/{target}/pre-ack"].put!;
        operationObject.summary = "Confirms a link as acknowledged";
        operationObject.description = "The authenticated user must be the owner of the LOC.";
        operationObject.responses = getDefaultResponsesNoContent();
        setPathParameters(operationObject, {
            'requestId': "The ID of the LOC",
            'target': "The item's name hash"
        });
    }

    @HttpPut('/:requestId/links/:target/pre-ack')
    @Async()
    @SendsResponse()
    async preAcknowledgeLink(_body: never, requestId: string, target: string) {
        await this.locRequestService.update(requestId, async request => {
            const contributor = await this.locAuthorizationService.ensureContributor(Contribution.locContribution(this.request, request));
            if(!request.canPreAcknowledgeLink(target, contributor)) {
                throw unauthorized("Only owner or Verified Issuer are allowed to acknowledge");
            } else {
                request.preAcknowledgeLink(target, contributor);
            }
        });
        this.response.sendStatus(204);
    }

    static cancelPreAcknowledgeLink(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/{requestId}/links/{target}/pre-ack"].delete!;
        operationObject.summary = "Cancels a link acknowledgment";
        operationObject.description = "The authenticated user must be the owner of the LOC.";
        operationObject.responses = getDefaultResponsesNoContent();
        setPathParameters(operationObject, {
            'requestId': "The ID of the LOC",
            'target': "The item's name hash"
        });
    }

    @HttpDelete('/:requestId/links/:target/pre-ack')
    @Async()
    @SendsResponse()
    async cancelPreAcknowledgeLink(_body: never, requestId: string, target: string) {
        await this.locRequestService.update(requestId, async request => {
            const contributor = await this.locAuthorizationService.ensureContributor(Contribution.locContribution(this.request, request));
            if(!request.canPreAcknowledgeLink(target, contributor)) {
                throw unauthorized("Only owner or Verified Issuer are allowed to acknowledge");
            } else {
                request.cancelPreAcknowledgeLink(target, contributor);
            }
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
        await this.locRequestService.update(requestId, async request => {
            const contributor = await this.locAuthorizationService.ensureContributor(Contribution.itemContribution(this.request, request));
            const submissionType = contributor.equals(request.getOwner()) ? "MANUAL_BY_OWNER" : "MANUAL_BY_USER";
            request.addMetadataItem(this.toMetadata(addMetadataView, contributor), submissionType);
        });
        this.response.sendStatus(204);
    }

    toMetadata(addMetadataView: AddMetadataView, submitter: ValidAccountId): MetadataItemParams {
        const name = requireLength(addMetadataView, "name", 3, 255);
        const value = requireLength(addMetadataView, "value", 1, 4096);
        return { name, value, submitter }
    }

    static deleteMetadata(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/{requestId}/metadata/{nameHash}"].delete!;
        operationObject.summary = "Deletes a metadata item of the LOC";
        operationObject.description = "The authenticated user must be the owner of the LOC. The metadata item must not yet have been published in the blockchain.";
        operationObject.responses = getDefaultResponsesWithAnyBody();
        setPathParameters(operationObject, {
            'requestId': "The ID of the LOC",
            'nameHash': "The item's name hash"
        });
    }

    @HttpDelete('/:requestId/metadata/:nameHash')
    @Async()
    async deleteMetadata(_body: never, requestId: string, nameHash: string): Promise<void> {
        await this.locRequestService.update(requestId, async request => {
            const contributor = await this.locAuthorizationService.ensureContributor(Contribution.itemContribution(this.request, request));
            request.removeMetadataItem(contributor, Hash.fromHex(nameHash));
        });
    }

    static requestMetadataReview(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/{requestId}/metadata/{nameHash}/review-request"].post!;
        operationObject.summary = "Requests a review of the given metadata item";
        operationObject.description = "The authenticated user must be contributor of the LOC.";
        operationObject.responses = getDefaultResponsesWithAnyBody();
        setPathParameters(operationObject, {
            'requestId': "The ID of the LOC",
            'nameHash': "The item's name hash"
        });
    }

    @HttpPost('/:requestId/metadata/:nameHash/review-request')
    @Async()
    @SendsResponse()
    async requestMetadataReview(_body: never, requestId: string, nameHash: string) {
        const request = await this.locRequestService.update(requestId, async request => {
            if (request.status !== 'OPEN') {
                throw badRequest("LOC must be OPEN for requesting item review");
            }
            await this.locAuthorizationService.ensureContributor(Contribution.itemContribution(this.request, request));
            request.requestMetadataItemReview(Hash.fromHex(nameHash));
        });

        const { userIdentity } = await this.locRequestAdapter.findUserPrivateData(request);
        this.notify("LegalOfficer", "review-requested", request.getDescription(), userIdentity);

        this.response.sendStatus(204);
    }

    static reviewMetadata(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/{requestId}/metadata/{nameHash}/review"].post!;
        operationObject.summary = "Reviews the given metadata item";
        operationObject.description = "The authenticated user must be the owner of the LOC.";
        operationObject.requestBody = getRequestBody({
            description: "Accept/Reject with reason",
            view: "ReviewItemView",
        });
        operationObject.responses = getDefaultResponsesNoContent();
        setPathParameters(operationObject, {
            'requestId': "The ID of the LOC",
            'nameHash': "The item's name hash"
        });
    }

    @HttpPost('/:requestId/metadata/:nameHash/review')
    @Async()
    @SendsResponse()
    async reviewMetadata(view: ReviewItemView, requestId: string, nameHash: string) {
        const authenticatedUser = await this.authenticationService.authenticatedUser(this.request);
        const hash = Hash.fromHex(nameHash);
        const request = await this.locRequestService.update(requestId, async request => {
            authenticatedUser.require(user => user.is(request.getOwner()));
            if (view.decision === "ACCEPT") {
                request.acceptMetadataItem(hash);
            } else {
                const reason = requireDefined(view.rejectReason, () => badRequest("Reason is required"));
                request.rejectMetadataItem(hash, reason);
            }
        });

        if(request.status !== "REVIEW_PENDING") {
            const { userIdentity } = await this.locRequestAdapter.findUserPrivateData(request);
            this.notify("WalletUser", "data-reviewed", request.getDescription(), userIdentity);
        }

        this.response.sendStatus(204);
    }

    static prePublishOrAcknowledgeMetadataItem(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/{requestId}/metadata/{nameHash}/pre-publish-ack"].put!;
        operationObject.summary = "Confirms a metadata item of the LOC";
        operationObject.description = "The authenticated user must be the owner of the LOC. Once a metadata item is confirmed, it cannot be deleted anymore.";
        operationObject.responses = getDefaultResponsesNoContent();
        setPathParameters(operationObject, {
            'requestId': "The ID of the LOC",
            'nameHash': "The item's name hash"
        });
    }

    @HttpPut('/:requestId/metadata/:nameHash/pre-publish-ack')
    @Async()
    @SendsResponse()
    async prePublishOrAcknowledgeMetadataItem(_body: never, requestId: string, nameHash: string) {
        await this.locRequestService.update(requestId, async request => {
            const contributor = await this.locAuthorizationService.ensureContributor(Contribution.locContribution(this.request, request));
            const hash = Hash.fromHex(nameHash);
            if(request.canPrePublishOrAcknowledgeMetadataItem(hash, contributor)) {
                request.prePublishOrAcknowledgeMetadataItem(hash, contributor);
            } else {
                throw unauthorized("Contributor cannot confirm");
            }
        });
        this.response.sendStatus(204);
    }

    static cancelPrePublishOrAcknowledgeMetadataItem(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/{requestId}/metadata/{nameHash}/pre-publish-ack"].delete!;
        operationObject.summary = "Cancels a metadata item publication";
        operationObject.description = "The authenticated user must be the owner of the LOC. Once a metadata item is confirmed, it cannot be deleted anymore.";
        operationObject.responses = getDefaultResponsesNoContent();
        setPathParameters(operationObject, {
            'requestId': "The ID of the LOC",
            'nameHash': "The item's name hash"
        });
    }

    @HttpDelete('/:requestId/metadata/:nameHash/pre-publish-ack')
    @Async()
    @SendsResponse()
    async cancelPrePublishOrAcknowledgeMetadataItem(_body: never, requestId: string, nameHash: string) {
        await this.locRequestService.update(requestId, async request => {
            const contributor = await this.locAuthorizationService.ensureContributor(Contribution.locContribution(this.request, request));
            const hash = Hash.fromHex(nameHash);
            if(request.canPrePublishOrAcknowledgeMetadataItem(hash, contributor)) {
                request.cancelPrePublishOrAcknowledgeMetadataItem(hash, contributor);
            } else {
                throw unauthorized("Contributor cannot confirm");
            }
        });
        this.response.sendStatus(204);
    }

    static preAcknowledgeMetadataItem(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/{requestId}/metadata/{nameHashHex}/pre-ack"].put!;
        operationObject.summary = "Confirms a metadata item as acknowledged";
        operationObject.description = "The authenticated user must be the owner of the LOC.";
        operationObject.responses = getDefaultResponsesNoContent();
        setPathParameters(operationObject, {
            'requestId': "The ID of the LOC",
            'nameHashHex': "The item's name hash"
        });
    }

    @HttpPut('/:requestId/metadata/:nameHashHex/pre-ack')
    @Async()
    @SendsResponse()
    async preAcknowledgeMetadataItem(_body: never, requestId: string, nameHashHex: string) {
        const nameHash = Hash.fromHex(nameHashHex);
        await this.locRequestService.update(requestId, async request => {
            const contributor = await this.locAuthorizationService.ensureContributor(Contribution.locContribution(this.request, request));
            if(!request.canPreAcknowledgeMetadataItem(nameHash, contributor)) {
                throw unauthorized("Only owner or Verified Issuer are allowed to acknowledge");
            } else {
                request.preAcknowledgeMetadataItem(nameHash, contributor);
            }
        });
        this.response.sendStatus(204);
    }

    static cancelPreAcknowledgeMetadataItem(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/{requestId}/metadata/{nameHashHex}/pre-ack"].delete!;
        operationObject.summary = "Cancel a metadata item acknowledgment";
        operationObject.description = "The authenticated user must be the owner of the LOC.";
        operationObject.responses = getDefaultResponsesNoContent();
        setPathParameters(operationObject, {
            'requestId': "The ID of the LOC",
            'nameHashHex': "The item's name hash"
        });
    }

    @HttpDelete('/:requestId/metadata/:nameHashHex/pre-ack')
    @Async()
    @SendsResponse()
    async cancelPreAcknowledgeMetadataItem(_body: never, requestId: string, nameHashHex: string) {
        const nameHash = Hash.fromHex(nameHashHex);
        await this.locRequestService.update(requestId, async request => {
            const contributor = await this.locAuthorizationService.ensureContributor(Contribution.locContribution(this.request, request));
            if(!request.canPreAcknowledgeMetadataItem(nameHash, contributor)) {
                throw unauthorized("Only owner or Verified Issuer are allowed to acknowledge");
            } else {
                request.cancelPreAcknowledgeMetadataItem(nameHash, contributor);
            }
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
        const contributor = await this.locAuthorizationService.ensureContributor(Contribution.locContribution(this.request, loc));

        let description = `Statement of Facts for LOC ${ new UUID(locId).toDecimalString() }`;
        let linkNature = `Original LOC`;
        if (loc.locType === 'Collection') {
            const itemId = Hash.fromHex(requireDefined(createSofRequestView.itemId,
                () => badRequest("Missing itemId")));
            requireDefined(await this.collectionRepository.findBy(locId, itemId),
                () => badRequest("Item not found"));
            description = `${ description } - ${ itemId }`
            linkNature = `${ linkNature } - Collection Item: ${ itemId }`
        }
        const ownerAddress = loc.getOwner();
        const requesterIdentityLoc = await this.locRequestRepository.getValidPolkadotIdentityLoc(contributor, loc.getOwner())
        const requestDescription: LocRequestDescription = {
            requesterAddress: contributor,
            requesterIdentityLoc: requesterIdentityLoc?.id,
            ownerAddress,
            description,
            locType: 'Transaction',
            createdOn: moment().toISOString(),
            userIdentity: undefined,
            userPostalAddress: undefined,
            fees: this.toLocFees(createSofRequestView, "Transaction"),
        }
        const request: LocRequestAggregateRoot = await this.locRequestFactory.newSofRequest({
            id: uuid(),
            description: requestDescription,
            target: locId,
            nature: linkNature,
            submitter: contributor,
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
        Promise<{ legalOfficerEMail: string, data: LocalsObject }> {

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

    static addSecret(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/{requestId}/secrets"].post!;
        operationObject.summary = "Creates a new recoverable secret";
        operationObject.description = "The authenticated user must be the LOC requester";
        operationObject.requestBody = getRequestBody({
            description: "Secret creation data",
            view: "AddSecretView",
        });
        operationObject.responses = getDefaultResponsesNoContent();
        setPathParameters(operationObject, {
            'requestId': "The ID of the LOC",
        });
    }

    @Async()
    @HttpPost('/:requestId/secrets')
    @SendsResponse()
    async addSecret(body: AddSecretView, requestId: string) {
        const authenticatedUser = await this.authenticationService.authenticatedUser(this.request);

        const name = requireDefined(body.name, () => badRequest("Missing recoverable secret name"));
        const value = requireDefined(body.value, () => badRequest("Missing recoverable secret value"));
        const request = await this.locRequestService.update(requestId, async request => {
            if(!request.isRequester(authenticatedUser.validAccountId)) {
                throw unauthorized("Only requester can add recoverable secrets");
            }
            try {
                request.addSecret(name, value);
            } catch(e) {
                if(e instanceof Error) {
                    throw badRequest(e.message);
                } else {
                    throw e;
                }
            }
        });

        const description = request.getDescription();
        const userIdentity = requireDefined(description.userIdentity);
        this.getNotificationInfo(description, userIdentity)
            .then(info => this.notificationService.notify(userIdentity.email, "recoverable-secret-added", {
                ...info.data,
                secretName: name,
            }))
            .catch(error => logger.error(error));

        this.response.sendStatus(204);
    }

    static removeSecret(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/{requestId}/secrets/{secretName}"].delete!;
        operationObject.summary = "Removes an existing recoverable secret";
        operationObject.description = "The authenticated user must be the LOC requester";
        operationObject.responses = getDefaultResponsesNoContent();
        setPathParameters(operationObject, {
            'requestId': "The ID of the LOC",
            'secretName': "The secret's name"
        });
    }

    @Async()
    @HttpDelete('/:requestId/secrets/:secretName')
    @SendsResponse()
    async removeSecret(_body: never, requestId: string, secretName: string) {
        const authenticatedUser = await this.authenticationService.authenticatedUser(this.request);

        const decodedSecretName = decodeURIComponent(secretName);
        await this.locRequestService.update(requestId, async request => {
            if(!request.isRequester(authenticatedUser.validAccountId)) {
                throw unauthorized("Only requester can add recoverable secrets");
            }
            try {
                request.removeSecret(decodedSecretName);
            } catch(e) {
                if(e instanceof Error) {
                    throw badRequest(e.message);
                } else {
                    throw e;
                }
            }
        });

        this.response.sendStatus(204);
    }
}
