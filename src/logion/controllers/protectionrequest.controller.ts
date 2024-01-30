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
    badRequest,
    Log,
    AuthenticationService,
} from '@logion/rest-api-core';

import {
    ProtectionRequestRepository,
    FetchProtectionRequestsSpecification,
    ProtectionRequestAggregateRoot,
    ProtectionRequestFactory,
    ProtectionRequestDescription,
    LegalOfficerDecisionDescription,
} from '../model/protectionrequest.model.js';
import { components } from './components.js';
import { NotificationService, Template, NotificationRecipient } from "../services/notification.service.js";
import { DirectoryService } from "../services/directory.service.js";
import { ProtectionRequestService } from '../services/protectionrequest.service.js';
import { LocalsObject } from 'pug';
import { LocRequestAdapter, UserPrivateData } from "./adapters/locrequestadapter.js";

type CreateProtectionRequestView = components["schemas"]["CreateProtectionRequestView"];
type ProtectionRequestView = components["schemas"]["ProtectionRequestView"];
type FetchProtectionRequestsSpecificationView = components["schemas"]["FetchProtectionRequestsSpecificationView"];
type FetchProtectionRequestsResponseView = components["schemas"]["FetchProtectionRequestsResponseView"];
type RejectProtectionRequestView = components["schemas"]["RejectProtectionRequestView"];
type AcceptProtectionRequestView = components["schemas"]["AcceptProtectionRequestView"];
type UpdateProtectionRequestView = components["schemas"]["UpdateProtectionRequestView"];
type RecoveryInfoView = components["schemas"]["RecoveryInfoView"];

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
            requesterAddress: requester.address,
            requesterIdentityLoc,
            legalOfficerAddress,
            otherLegalOfficerAddress: body.otherLegalOfficerAddress,
            createdOn: moment().toISOString(),
            isRecovery: body.isRecovery,
            addressToRecover: body.addressToRecover || null,
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
        authenticatedUser.require(user => user.isOneOf([ body.legalOfficerAddress, body.requesterAddress ]));
        const specification = new FetchProtectionRequestsSpecification({
            expectedRequesterAddress: body.requesterAddress,
            expectedLegalOfficerAddress: body.legalOfficerAddress,
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

    adapt(request: ProtectionRequestAggregateRoot, userPrivateData: UserPrivateData): ProtectionRequestView {
        const { userIdentity, userPostalAddress } = userPrivateData;
        return {
            id: request.id!,
            requesterAddress: request.requesterAddress || "",
            requesterIdentityLoc: request.requesterIdentityLocId,
            legalOfficerAddress: request.legalOfficerAddress || "",
            otherLegalOfficerAddress: request.otherLegalOfficerAddress || "",
            userIdentity,
            userPostalAddress,
            decision: {
                rejectReason: request.decision!.rejectReason || "",
                decisionOn: request.decision!.decisionOn || undefined,
                locId: request.decision!.locId,
            },
            createdOn: request.createdOn!,
            isRecovery: request.isRecovery || false,
            addressToRecover: request.addressToRecover || undefined,
            status: request.status!,
        };
    }

    static rejectProtectionRequest(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/protection-request/{id}/reject"].post!;
        operationObject.summary = "Rejects a Protection Request";
        operationObject.description = "The authenticated user must be one of the legal officers of the protection request";
        operationObject.requestBody = getRequestBody({
            description: "Protection Request rejection data",
            view: "RejectProtectionRequestView",
        });
        operationObject.responses = getDefaultResponses("ProtectionRequestView");
        setPathParameters(operationObject, { 'id': "The ID of the request to reject" });
    }

    @Async()
    @HttpPost('/:id/reject')
    async rejectProtectionRequest(body: RejectProtectionRequestView, id: string): Promise<ProtectionRequestView> {
        const authenticatedUser = await this.authenticationService.authenticatedUserIsLegalOfficerOnNode(this.request);
        const request = await this.protectionRequestService.update(id, async request => {
            authenticatedUser.require(user => user.is(request.legalOfficerAddress))
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
    async acceptProtectionRequest(body: AcceptProtectionRequestView, id: string): Promise<ProtectionRequestView> {
        const authenticatedUser = await this.authenticationService.authenticatedUserIsLegalOfficerOnNode(this.request);
        if(body.locId === undefined || body.locId === null) {
            throw badRequest("Missing LOC ID");
        }
        const request = await this.protectionRequestService.update(id, async request => {
            authenticatedUser.require(user => user.is(request.legalOfficerAddress))
            request.accept(moment(), body.locId!);
        });
        const templateId: Template = request.isRecovery ? "recovery-accepted" : "protection-accepted";
        const userPrivateData = await this.locRequestAdapter.getUserPrivateData(request.requesterIdentityLocId!)
        this.notify("WalletUser", templateId, request.getDescription(), userPrivateData, request.getDecision());
        return this.adapt(request, userPrivateData);
    }

    static fetchRecoveryInfo(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/protection-request/{id}/recovery-info"].put!;
        operationObject.summary = "Fetch all info necessary for the legal officer to accept or reject recovery.";
        operationObject.description = "The authentication user must be either the protection requester, the recovery requester, or one of the legal officers";
        operationObject.responses = getDefaultResponses("RecoveryInfoView");
        setPathParameters(operationObject, { 'id': "The ID of the recovery request" });
    }

    @Async()
    @HttpPut('/:id/recovery-info')
    async fetchRecoveryInfo(_body: never, id: string): Promise<RecoveryInfoView> {
        const authenticatedUser = await this.authenticationService.authenticatedUserIsLegalOfficerOnNode(this.request);

        const recovery = await this.protectionRequestRepository.findById(id);
        authenticatedUser.require(user => user.is(recovery?.legalOfficerAddress));
        if(recovery === null
            || !recovery.isRecovery
            || recovery.status !== 'PENDING'
            || recovery.addressToRecover === null) {
            throw new Error("Pending recovery request with address to recover not found");
        }

        const addressToRecover = recovery.getDescription().addressToRecover!;
        const querySpecification = new FetchProtectionRequestsSpecification({
            expectedRequesterAddress: addressToRecover,
            expectedLegalOfficerAddress: authenticatedUser.address,
            expectedStatuses: [ 'ACTIVATED' ]
        });
        const protectionRequests = await this.protectionRequestRepository.findBy(querySpecification);
        const recoveryUserPrivateData = await this.locRequestAdapter.getUserPrivateData(recovery.requesterIdentityLocId!)
        if (protectionRequests.length === 0) {
            return {
                addressToRecover,
                recoveryAccount: this.adapt(recovery, recoveryUserPrivateData),
            };
        } else {
            const accountToRecoverUserPrivateData = await this.locRequestAdapter.getUserPrivateData(protectionRequests[0].requesterIdentityLocId!)
            return {
                addressToRecover,
                recoveryAccount: this.adapt(recovery, recoveryUserPrivateData),
                accountToRecover: this.adapt(protectionRequests[0], accountToRecoverUserPrivateData),
            };
        }
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
            authenticatedUser.require(user => user.is(request.requesterAddress));
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
            authenticatedUser.require(user => user.is(request.requesterAddress));
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
        const request = await this.protectionRequestService.update(id, async request => {
            authenticatedUser.require(user => user.is(request.requesterAddress));
            request.updateOtherLegalOfficer(requireDefined(updateProtectionRequestView.otherLegalOfficerAddress));
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
