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
    AccountRecoveryRepository,
    FetchAccountRecoveryRequestsSpecification,
    AccountRecoveryRequestFactory,
    AccountRecoveryRequestDescription,
    AccountRecoveryRequestStatus,
} from '../model/account_recovery.model.js';
import { components } from './components.js';
import { NotificationService, Template, NotificationRecipient } from "../services/notification.service.js";
import { DirectoryService } from "../services/directory.service.js";
import { AccountRecoveryRequestService } from '../services/accountrecoveryrequest.service.js';
import { LocalsObject } from 'pug';
import { LocRequestAdapter, UserPrivateData } from "./adapters/locrequestadapter.js";
import { LocRequestRepository } from '../model/locrequest.model.js';
import { ValidAccountId } from "@logion/node-api";
import { LegalOfficerDecisionDescription } from '../model/decision.js';
import { EMPTY_POSTAL_ADDRESS } from '../model/postaladdress.js';
import { EMPTY_USER_IDENTITY } from '../model/useridentity.js';

type CreateAccountRecoveryRequestView = components["schemas"]["CreateAccountRecoveryRequestView"];
type AccountRecoveryRequestView = components["schemas"]["AccountRecoveryRequestView"];
type FetchAccountRecoveryRequestsSpecificationView = components["schemas"]["FetchAccountRecoveryRequestsSpecificationView"];
type FetchAccountRecoveryRequestsResponseView = components["schemas"]["FetchAccountRecoveryRequestsResponseView"];
type RejectRecoveryRequestView = components["schemas"]["RejectRecoveryRequestView"];
type RecoveryInfoView = components["schemas"]["RecoveryInfoView"];
type RecoveryInfoIdentityView = components["schemas"]["RecoveryInfoIdentityView"];

const { logger } = Log;

export function fillInSpec(spec: OpenAPIV3.Document): void {
    const tagName = 'Account Recovery Requests';
    addTag(spec, {
        name: tagName,
        description: "Handling of Account Recovery Requests"
    });
    setControllerTag(spec, /^\/api\/account-recovery.*/, tagName);

    AccountRecoveryController.createRequest(spec);
    AccountRecoveryController.fetchRequests(spec);
    AccountRecoveryController.rejectRequest(spec);
    AccountRecoveryController.acceptRequest(spec);
    AccountRecoveryController.fetchRecoveryInfo(spec);
    AccountRecoveryController.cancel(spec);
}

interface AccountRecoveryRequestPublicFields {

    id?: string;

    getAddressToRecover(): ValidAccountId | null;

    createdOn?: string;

    getRequester(): ValidAccountId;

    requesterIdentityLocId?: string;

    status?: AccountRecoveryRequestStatus;

    decision?: { decisionOn?: string, rejectReason?: string };

    getLegalOfficer(): ValidAccountId;

    getOtherLegalOfficer(): ValidAccountId;
}

@injectable()
@Controller('/account-recovery')
export class AccountRecoveryController extends ApiController {

    constructor(
        private accountRecoveryRequestRepository: AccountRecoveryRepository,
        private accountRecoveryRequestFactory: AccountRecoveryRequestFactory,
        private authenticationService: AuthenticationService,
        private notificationService: NotificationService,
        private directoryService: DirectoryService,
        private accountRecoveryRequestService: AccountRecoveryRequestService,
        private locRequestAdapter: LocRequestAdapter,
        private locRequestRepository: LocRequestRepository,
    ) {
        super();
    }

    static createRequest(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/account-recovery"].post!;
        operationObject.summary = "Creates a new Account Recovery Request";
        operationObject.description = "The authenticated user must be the recovery requester";
        operationObject.requestBody = getRequestBody({
            description: "Account Recovery request creation data",
            view: "CreateAccountRecoveryRequestView",
        });
        operationObject.responses = getDefaultResponses("AccountRecoveryRequestView");
    }

    @Async()
    @HttpPost('')
    async createRequest(body: CreateAccountRecoveryRequestView): Promise<AccountRecoveryRequestView> {
        const requester = await this.authenticationService.authenticatedUser(this.request);
        const legalOfficerAddress = await this.directoryService.requireLegalOfficerAddressOnNode(body.legalOfficerAddress);
        const requesterIdentityLoc = requireDefined(body.requesterIdentityLoc);
        const request = await this.accountRecoveryRequestFactory.newAccountRecoveryRequest({
            id: uuid(),
            requesterAddress: requester.validAccountId,
            requesterIdentityLoc,
            legalOfficerAddress,
            otherLegalOfficerAddress: ValidAccountId.polkadot(body.otherLegalOfficerAddress),
            createdOn: moment().toISOString(),
            addressToRecover: ValidAccountId.polkadot(body.addressToRecover),
        });
        await this.accountRecoveryRequestService.add(request);
        const userPrivateData = await this.locRequestAdapter.getUserPrivateData(requesterIdentityLoc)
        this.notify("LegalOfficer", "recovery-requested", request.getDescription(), userPrivateData)
        return this.adapt(request, userPrivateData);
    }

    static fetchRequests(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/account-recovery"].put!;
        operationObject.summary = "Lists requests based on a given specification";
        operationObject.description = "The authenticated user must be either the requester or one of the legal officers of the expected requests.";
        operationObject.requestBody = getRequestBody({
            description: "The specification for fetching requests",
            view: "FetchAccountRecoveryRequestsSpecificationView",
        });
        operationObject.responses = getDefaultResponses("FetchAccountRecoveryRequestsResponseView");
    }

    @Async()
    @HttpPut('')
    async fetchRequests(body: FetchAccountRecoveryRequestsSpecificationView): Promise<FetchAccountRecoveryRequestsResponseView> {
        const authenticatedUser = await this.authenticationService.authenticatedUser(this.request);
        const requester = body.requesterAddress ? ValidAccountId.polkadot(body.requesterAddress) : undefined;
        const legalOfficer = body.legalOfficerAddress ? ValidAccountId.polkadot(body.legalOfficerAddress) : undefined;
        authenticatedUser.require(user => user.isOneOf([ legalOfficer, requester ]));
        const specification = new FetchAccountRecoveryRequestsSpecification({
            expectedRequesterAddress: requester,
            expectedLegalOfficerAddress: legalOfficer ? [ legalOfficer ] : undefined,
            expectedStatuses: body.statuses,
        });
        const accountRecoveryRequests = await this.accountRecoveryRequestRepository.findBy(specification);
        const requests = accountRecoveryRequests.map(request =>
            this.locRequestAdapter.getUserPrivateData(request.getDescription().requesterIdentityLocId)
                .then(userPrivateData => this.adapt(request, userPrivateData))
        );
        return {
            requests: await Promise.all(requests)
        };
    }

    adapt(request: AccountRecoveryRequestPublicFields, userPrivateData: UserPrivateData): AccountRecoveryRequestView {
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
            addressToRecover: request.getAddressToRecover()?.address,
            status: request.status!,
        };
    }

    static rejectRequest(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/account-recovery/{id}/reject"].post!;
        operationObject.summary = "Rejects a request";
        operationObject.description = "The authenticated user must be one of the legal officers of the request";
        operationObject.requestBody = getRequestBody({
            description: "Request rejection data",
            view: "RejectRecoveryRequestView",
        });
        operationObject.responses = getDefaultResponses("AccountRecoveryRequestView");
        setPathParameters(operationObject, { 'id': "The ID of the request to reject" });
    }

    @Async()
    @HttpPost('/:id/reject')
    async rejectRequest(body: RejectRecoveryRequestView, id: string): Promise<AccountRecoveryRequestView> {
        const authenticatedUser = await this.authenticationService.authenticatedUserIsLegalOfficerOnNode(this.request);
        const request = await this.accountRecoveryRequestService.update(id, async request => {
            authenticatedUser.require(user => user.is(request.getLegalOfficer()))
            request.reject(body.rejectReason!, moment());
        });
        const userPrivateData = await this.locRequestAdapter.getUserPrivateData(request.requesterIdentityLocId!)
        this.notify("WalletUser", "recovery-rejected", request.getDescription(), userPrivateData, request.getDecision());
        return this.adapt(request, userPrivateData);
    }

    static acceptRequest(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/account-recovery/{id}/accept"].post!;
        operationObject.summary = "Accepts a request";
        operationObject.description = "The authenticated user must be one of the legal officers of the request";
        operationObject.responses = getDefaultResponses("AccountRecoveryRequestView");
        setPathParameters(operationObject, { 'id': "The ID of the request to accept" });
    }

    @Async()
    @HttpPost('/:id/accept')
    async acceptRequest(_body: never, id: string): Promise<AccountRecoveryRequestView> {
        const authenticatedUser = await this.authenticationService.authenticatedUserIsLegalOfficerOnNode(this.request);
        const request = await this.accountRecoveryRequestService.update(id, async request => {
            authenticatedUser.require(user => user.is(request.getLegalOfficer()))
            request.accept(moment());
        });
        const userPrivateData = await this.locRequestAdapter.getUserPrivateData(request.requesterIdentityLocId!)
        this.notify("WalletUser", "recovery-accepted", request.getDescription(), userPrivateData, request.getDecision());
        return this.adapt(request, userPrivateData);
    }

    static fetchRecoveryInfo(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/account-recovery/{id}/recovery-info"].put!;
        operationObject.summary = "Fetch all info necessary for the legal officer to accept or reject account recovery request.";
        operationObject.description = "The authentication user must be a legal officers on current node";
        operationObject.responses = getDefaultResponses("RecoveryInfoView");
        setPathParameters(operationObject, { 'id': "The ID of the recovery request" });
    }

    @Async()
    @HttpPut('/:id/recovery-info')
    async fetchRecoveryInfo(_body: never, id: string): Promise<RecoveryInfoView> {
        const authenticatedUser = await this.authenticationService.authenticatedUserIsLegalOfficerOnNode(this.request);

        const accountRecoveryRequest = await this.accountRecoveryRequestRepository.findById(id);
        if(accountRecoveryRequest === null
            || accountRecoveryRequest.status !== 'PENDING') {
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
                userIdentity: description.userIdentity || EMPTY_USER_IDENTITY,
                userPostalAddress: description.userPostalAddress || EMPTY_POSTAL_ADDRESS,
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

    static cancel(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/account-recovery/{id}/cancel"].post!;
        operationObject.summary = "Cancels a request";
        operationObject.description = "The authenticated user must be the requester";
        operationObject.responses = getDefaultResponsesNoContent();
        setPathParameters(operationObject, { 'id': "The ID of the request to cancel" });
    }

    @Async()
    @HttpPost('/:id/cancel')
    @SendsResponse()
    async cancel(_body: never, id: string): Promise<void> {
        const authenticatedUser = await this.authenticationService.authenticatedUser(this.request);
        const request = await this.accountRecoveryRequestService.update(id, async request => {
            authenticatedUser.require(user => user.is(request.getRequester()));
            request.cancel();
        });
        this.notify("LegalOfficer", 'recovery-cancelled', request.getDescription());
        this.response.sendStatus(204);
    }

    private notify(recipient: NotificationRecipient, templateId: Template, request: AccountRecoveryRequestDescription, userPrivateData?: UserPrivateData, decision?: LegalOfficerDecisionDescription): void {
        this.getNotificationInfo(request, userPrivateData, decision)
            .then(info => {
                const to = recipient === "WalletUser" ? info.userEmail : info.legalOfficerEMail
                return this.notificationService.notify(to, templateId, info.data)
                    .catch(reason => logger.warn("Failed to send email '%s' to %s : %s", templateId, to, reason))
            })
            .catch(reason =>
                logger.warn("Failed to retrieve notification info from directory: %s. Mail '%' not sent.", reason, templateId)
            )
    }

    private async getNotificationInfo(request: AccountRecoveryRequestDescription, userPrivateData?: UserPrivateData, decision?: LegalOfficerDecisionDescription):
        Promise<{ legalOfficerEMail: string, userEmail: string | undefined, data: LocalsObject }> {

        const legalOfficer = await this.directoryService.get(request.legalOfficerAddress)
        const otherLegalOfficer = await this.directoryService.get(request.otherLegalOfficerAddress)
        const { userIdentity, userPostalAddress } = userPrivateData ? userPrivateData : await this.locRequestAdapter.getUserPrivateData(request.requesterIdentityLocId)
        return {
            legalOfficerEMail: legalOfficer.userIdentity.email,
            userEmail: userIdentity?.email,
            data: {
                recovery: { ...request, decision },
                legalOfficer,
                otherLegalOfficer,
                walletUser: userIdentity,
                walletUserPostalAddress: userPostalAddress
            }
        }
    }

}
