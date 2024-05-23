import { injectable } from 'inversify';
import { ApiController, Controller, HttpPost, HttpPut, Async, SendsResponse } from 'dinoloop';
import { v4 as uuid } from 'uuid';
import moment from 'moment';
import { OpenAPIV3 } from 'express-oas-generator';
import {
    addTag,
    setControllerTag,
    getRequestBody,
    getDefaultResponses,
    setPathParameters,
    getDefaultResponsesNoContent,
    requireDefined,
    Log,
    AuthenticationService,
    badRequest,
} from '@logion/rest-api-core';

import {
    ProtectionRequestRepository,
    FetchProtectionRequestsSpecification,
    ProtectionRequestFactory,
    ProtectionRequestDescription,
    ProtectionRequestStatus,
} from '../model/protectionrequest.model.js';
import { components } from './components.js';
import { NotificationService, Template, NotificationRecipient } from "../services/notification.service.js";
import { DirectoryService } from "../services/directory.service.js";
import { ProtectionRequestService } from '../services/protectionrequest.service.js';
import { LocalsObject } from 'pug';
import { LocRequestAdapter, UserPrivateData } from "./adapters/locrequestadapter.js";
import { LocRequestRepository } from '../model/locrequest.model.js';
import { ValidAccountId } from "@logion/node-api";
import { LegalOfficerDecisionDescription } from '../model/decision.js';

type CreateProtectionRequestView = components["schemas"]["CreateProtectionRequestView"];
type ProtectionRequestView = components["schemas"]["ProtectionRequestView"];
type FetchProtectionRequestsSpecificationView = components["schemas"]["FetchProtectionRequestsSpecificationView"];
type FetchProtectionRequestsResponseView = components["schemas"]["FetchProtectionRequestsResponseView"];
type RejectRecoveryRequestView = components["schemas"]["RejectRecoveryRequestView"];
type UpdateProtectionRequestView = components["schemas"]["UpdateProtectionRequestView"];
type RecoveryInfoView = components["schemas"]["RecoveryInfoView"];
type RecoveryInfoIdentityView = components["schemas"]["RecoveryInfoIdentityView"];

const { logger } = Log;

export function fillInSpec(spec: OpenAPIV3.Document): void {
    const tagName = 'Protection Requests';
    addTag(spec, {
        name: tagName,
        description: "Handling of Protection Requests"
    });
    setControllerTag(spec, /^\/api\/protection-request.*/, tagName);

    ProtectionRequestController.createProtectionRequest(spec);
    ProtectionRequestController.fetchProtectionRequests(spec);
    ProtectionRequestController.rejectProtectionRequest(spec);
    ProtectionRequestController.acceptProtectionRequest(spec);
    ProtectionRequestController.fetchRecoveryInfo(spec);
    ProtectionRequestController.resubmit(spec);
    ProtectionRequestController.cancel(spec);
    ProtectionRequestController.update(spec);
}

interface ProtectionRequestPublicFields {

    id?: string;

    getAddressToRecover(): ValidAccountId | null;

    createdOn?: string;

    isRecovery?: boolean;

    getRequester(): ValidAccountId;

    requesterIdentityLocId?: string;

    status?: ProtectionRequestStatus;

    decision?: { decisionOn?: string, rejectReason?: string };

    getLegalOfficer(): ValidAccountId;

    getOtherLegalOfficer(): ValidAccountId;
}

@injectable()
@Controller('/protection-request')
export class ProtectionRequestController extends ApiController {

    constructor(
        private protectionRequestRepository: ProtectionRequestRepository,
        private protectionRequestFactory: ProtectionRequestFactory,
        private authenticationService: AuthenticationService,
        private notificationService: NotificationService,
        private directoryService: DirectoryService,
        private protectionRequestService: ProtectionRequestService,
        private locRequestAdapter: LocRequestAdapter,
        private locRequestRepository: LocRequestRepository,
    ) {
        super();
    }

    static createProtectionRequest(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/protection-request"].post!;
        operationObject.summary = "Creates a new Protection Request";
        operationObject.description = "The authenticated user must be the protection/recovery requester";
        operationObject.requestBody = getRequestBody({
            description: "Protection request creation data",
            view: "CreateProtectionRequestView",
        });
        operationObject.responses = getDefaultResponses("ProtectionRequestView");
    }

    @Async()
    @HttpPost('')
    async createProtectionRequest(body: CreateProtectionRequestView): Promise<ProtectionRequestView> {
        const requester = await this.authenticationService.authenticatedUser(this.request);
        const legalOfficerAddress = await this.directoryService.requireLegalOfficerAddressOnNode(body.legalOfficerAddress);
        const requesterIdentityLoc = requireDefined(body.requesterIdentityLoc);
        const request = await this.protectionRequestFactory.newProtectionRequest({
            id: uuid(),
            requesterAddress: requester.validAccountId,
            requesterIdentityLoc,
            legalOfficerAddress,
            otherLegalOfficerAddress: ValidAccountId.polkadot(body.otherLegalOfficerAddress),
            createdOn: moment().toISOString(),
            isRecovery: body.isRecovery,
            addressToRecover: body.addressToRecover ? ValidAccountId.polkadot(body.addressToRecover) : null,
        });
        await this.protectionRequestService.add(request);
        const templateId: Template = request.isRecovery ? "recovery-requested" : "protection-requested"
        const userPrivateData = await this.locRequestAdapter.getUserPrivateData(requesterIdentityLoc)
        this.notify("LegalOfficer", templateId, request.getDescription(), userPrivateData)
        return this.adapt(request, userPrivateData);
    }

    static fetchProtectionRequests(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/protection-request"].put!;
        operationObject.summary = "Lists Protection Requests based on a given specification";
        operationObject.description = "The authenticated user must be either the requester or one of the legal officers of the expected protection requests.";
        operationObject.requestBody = getRequestBody({
            description: "The specification for fetching Protection Requests",
            view: "FetchProtectionRequestsSpecificationView",
        });
        operationObject.responses = getDefaultResponses("FetchProtectionRequestsResponseView");
    }

    @Async()
    @HttpPut('')
    async fetchProtectionRequests(body: FetchProtectionRequestsSpecificationView): Promise<FetchProtectionRequestsResponseView> {
        const authenticatedUser = await this.authenticationService.authenticatedUser(this.request);
        const requester = body.requesterAddress ? ValidAccountId.polkadot(body.requesterAddress) : undefined;
        const legalOfficer = body.legalOfficerAddress ? ValidAccountId.polkadot(body.legalOfficerAddress) : undefined;
        authenticatedUser.require(user => user.isOneOf([ legalOfficer, requester ]));
        const specification = new FetchProtectionRequestsSpecification({
            expectedRequesterAddress: requester,
            expectedLegalOfficerAddress: legalOfficer ? [ legalOfficer ] : undefined,
            expectedStatuses: body.statuses,
            kind: body.kind,
        });
        const protectionRequests = await this.protectionRequestRepository.findBy(specification);
        const requests = protectionRequests.map(request =>
            this.locRequestAdapter.getUserPrivateData(request.getDescription().requesterIdentityLocId)
                .then(userPrivateData => this.adapt(request, userPrivateData))
        );
        return {
            requests: await Promise.all(requests)
        };
    }

    adapt(request: ProtectionRequestPublicFields, userPrivateData: UserPrivateData): ProtectionRequestView {
        const { userIdentity, userPostalAddress } = userPrivateData;
        return {
            id: request.id!,
            requesterAddress: request.getRequester().address,
            requesterIdentityLoc: request.requesterIdentityLocId,
            legalOfficerAddress: request.getLegalOfficer().address,
            otherLegalOfficerAddress: request.getOtherLegalOfficer().address,
            userIdentity,
            userPostalAddress,
            decision: {
                rejectReason: request.decision!.rejectReason || "",
                decisionOn: request.decision!.decisionOn || undefined,
            },
            createdOn: request.createdOn!,
            isRecovery: request.isRecovery || false,
            addressToRecover: request.getAddressToRecover()?.address,
            status: request.status!,
        };
    }

    static rejectProtectionRequest(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/protection-request/{id}/reject"].post!;
        operationObject.summary = "Rejects a Protection Request";
        operationObject.description = "The authenticated user must be one of the legal officers of the protection request";
        operationObject.requestBody = getRequestBody({
            description: "Protection Request rejection data",
            view: "RejectRecoveryRequestView",
        });
        operationObject.responses = getDefaultResponses("ProtectionRequestView");
        setPathParameters(operationObject, { 'id': "The ID of the request to reject" });
    }

    @Async()
    @HttpPost('/:id/reject')
    async rejectProtectionRequest(body: RejectRecoveryRequestView, id: string): Promise<ProtectionRequestView> {
        const authenticatedUser = await this.authenticationService.authenticatedUserIsLegalOfficerOnNode(this.request);
        const request = await this.protectionRequestService.update(id, async request => {
            authenticatedUser.require(user => user.is(request.getLegalOfficer()))
            request.reject(body.rejectReason!, moment());
        });
        const templateId: Template = request.isRecovery ? "recovery-rejected" : "protection-rejected";
        const userPrivateData = await this.locRequestAdapter.getUserPrivateData(request.requesterIdentityLocId!)
        this.notify("WalletUser", templateId, request.getDescription(), userPrivateData, request.getDecision());
        return this.adapt(request, userPrivateData);
    }

    static acceptProtectionRequest(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/protection-request/{id}/accept"].post!;
        operationObject.summary = "Accepts a Protection Request";
        operationObject.description = "The authenticated user must be one of the legal officers of the protection request";
        operationObject.requestBody = getRequestBody({
            description: "Protection Request acceptance data",
            view: "AcceptProtectionRequestView",
        });
        operationObject.responses = getDefaultResponses("ProtectionRequestView");
        setPathParameters(operationObject, { 'id': "The ID of the request to accept" });
    }

    @Async()
    @HttpPost('/:id/accept')
    async acceptProtectionRequest(_body: never, id: string): Promise<ProtectionRequestView> {
        const authenticatedUser = await this.authenticationService.authenticatedUserIsLegalOfficerOnNode(this.request);
        const request = await this.protectionRequestService.update(id, async request => {
            authenticatedUser.require(user => user.is(request.getLegalOfficer()))
            request.accept(moment());
        });
        const templateId: Template = request.isRecovery ? "recovery-accepted" : "protection-accepted";
        const userPrivateData = await this.locRequestAdapter.getUserPrivateData(request.requesterIdentityLocId!)
        this.notify("WalletUser", templateId, request.getDescription(), userPrivateData, request.getDecision());
        return this.adapt(request, userPrivateData);
    }

    static fetchRecoveryInfo(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/protection-request/{id}/recovery-info"].put!;
        operationObject.summary = "Fetch all info necessary for the legal officer to accept or reject account recovery request.";
        operationObject.description = "The authentication user must be a legal officers on current node";
        operationObject.responses = getDefaultResponses("RecoveryInfoView");
        setPathParameters(operationObject, { 'id': "The ID of the recovery request" });
    }

    @Async()
    @HttpPut('/:id/recovery-info')
    async fetchRecoveryInfo(_body: never, id: string): Promise<RecoveryInfoView> {
        const authenticatedUser = await this.authenticationService.authenticatedUserIsLegalOfficerOnNode(this.request);

        const accountRecoveryRequest = await this.protectionRequestRepository.findById(id);
        if(accountRecoveryRequest === null
            || !accountRecoveryRequest.isRecovery
            || accountRecoveryRequest.status !== 'PENDING'
            || !accountRecoveryRequest.addressToRecover) {
            throw badRequest("Pending recovery request with address to recover not found");
        }
        authenticatedUser.require(user => user.is(accountRecoveryRequest.getLegalOfficer()));

        const addressToRecover = requireDefined(accountRecoveryRequest.getDescription().addressToRecover);
        const identity1Loc = await this.locRequestRepository.getValidPolkadotIdentityLoc(
            addressToRecover,
            accountRecoveryRequest.getLegalOfficer()
        );
        let identity1: RecoveryInfoIdentityView | undefined;
        if(identity1Loc) {
            const description = identity1Loc.getDescription();
            identity1 = {
                userIdentity: description.userIdentity,
                userPostalAddress: description.userPostalAddress,
            };
        }
        const identity2PrivateData = await this.locRequestAdapter.getUserPrivateData(accountRecoveryRequest.requesterIdentityLocId!);
        return {
            identity1,
            identity2: {
                userIdentity: identity2PrivateData.userIdentity,
                userPostalAddress: identity2PrivateData.userPostalAddress,
            },
            type: "ACCOUNT",
            accountRecovery: {
                address1: identity1Loc?.getRequester()?.address,
                address2: accountRecoveryRequest.getRequester().address,
            },
        };
    }

    static resubmit(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/protection-request/{id}/resubmit"].post!;
        operationObject.summary = "Re-submit a Protection Request";
        operationObject.description = "The authenticated user must be the protection requester";
        operationObject.responses = getDefaultResponsesNoContent();
        setPathParameters(operationObject, { 'id': "The ID of the request to resubmit" });
    }

    @Async()
    @HttpPost('/:id/resubmit')
    @SendsResponse()
    async resubmit(_body: never, id: string): Promise<void> {
        const authenticatedUser = await this.authenticationService.authenticatedUser(this.request);
        const request = await this.protectionRequestService.update(id, async request => {
            authenticatedUser.require(user => user.is(request.getRequester()));
            request.resubmit();
        });
        this.notify("LegalOfficer", request.isRecovery ? 'recovery-resubmitted' : 'protection-resubmitted', request.getDescription());
        this.response.sendStatus(204);
    }

    static cancel(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/protection-request/{id}/cancel"].post!;
        operationObject.summary = "Cancels a Protection Request";
        operationObject.description = "The authenticated user must be the protection requester";
        operationObject.responses = getDefaultResponsesNoContent();
        setPathParameters(operationObject, { 'id': "The ID of the request to cancel" });
    }

    @Async()
    @HttpPost('/:id/cancel')
    @SendsResponse()
    async cancel(_body: never, id: string): Promise<void> {
        const authenticatedUser = await this.authenticationService.authenticatedUser(this.request);
        const request = await this.protectionRequestService.update(id, async request => {
            authenticatedUser.require(user => user.is(request.getRequester()));
            request.cancel();
        });
        this.notify("LegalOfficer", request.isRecovery ? 'recovery-cancelled' : 'protection-cancelled', request.getDescription());
        this.response.sendStatus(204);
    }

    static update(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/protection-request/{id}/update"].put!;
        operationObject.summary = "Updates a Protection Request";
        operationObject.description = "The authenticated user must be the protection requester";
        operationObject.responses = getDefaultResponsesNoContent();
        operationObject.requestBody = getRequestBody({
            description: "Protection Request update data",
            view: "UpdateProtectionRequestView",
        });
        setPathParameters(operationObject, { 'id': "The ID of the request to update" });
    }

    @Async()
    @HttpPut('/:id/update')
    @SendsResponse()
    async update(updateProtectionRequestView: UpdateProtectionRequestView, id: string): Promise<void> {
        const authenticatedUser = await this.authenticationService.authenticatedUser(this.request);
        const otherLegalOfficerAddress = ValidAccountId.polkadot(requireDefined(updateProtectionRequestView.otherLegalOfficerAddress));
        const request = await this.protectionRequestService.update(id, async request => {
            authenticatedUser.require(user => user.is(request.getRequester()));
            request.updateOtherLegalOfficer(otherLegalOfficerAddress);
        });
        this.notify("LegalOfficer", 'protection-updated', request.getDescription());
        this.response.sendStatus(204);
    }

    private notify(recipient: NotificationRecipient, templateId: Template, protection: ProtectionRequestDescription, userPrivateData?: UserPrivateData, decision?: LegalOfficerDecisionDescription): void {
        this.getNotificationInfo(protection, userPrivateData, decision)
            .then(info => {
                const to = recipient === "WalletUser" ? info.userEmail : info.legalOfficerEMail
                return this.notificationService.notify(to, templateId, info.data)
                    .catch(reason => logger.warn("Failed to send email '%s' to %s : %s", templateId, to, reason))
            })
            .catch(reason =>
                logger.warn("Failed to retrieve notification info from directory: %s. Mail '%' not sent.", reason, templateId)
            )
    }

    private async getNotificationInfo(protection: ProtectionRequestDescription, userPrivateData?: UserPrivateData, decision?: LegalOfficerDecisionDescription):
        Promise<{ legalOfficerEMail: string, userEmail: string | undefined, data: LocalsObject }> {

        const legalOfficer = await this.directoryService.get(protection.legalOfficerAddress)
        const otherLegalOfficer = await this.directoryService.get(protection.otherLegalOfficerAddress)
        const { userIdentity, userPostalAddress } = userPrivateData ? userPrivateData : await this.locRequestAdapter.getUserPrivateData(protection.requesterIdentityLocId)
        return {
            legalOfficerEMail: legalOfficer.userIdentity.email,
            userEmail: userIdentity?.email,
            data: {
                protection: { ...protection, decision },
                legalOfficer,
                otherLegalOfficer,
                walletUser: userIdentity,
                walletUserPostalAddress: userPostalAddress
            }
        }
    }

}
