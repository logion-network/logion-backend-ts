import { injectable } from 'inversify';
import { ApiController, Controller, HttpPost, HttpPut, Async } from 'dinoloop';
import { v4 as uuid } from 'uuid';
import moment from 'moment';
import { OpenAPIV3 } from 'express-oas-generator';
import {
    Log,
    addTag,
    setControllerTag,
    getRequestBody,
    getDefaultResponses,
    setPathParameters,
    requireDefined,
    badRequest,
    AuthenticationService,
    PolkadotService,
} from "@logion/rest-api-core";
import {
    VaultTransferRequestRepository,
    FetchVaultTransferRequestsSpecification,
    VaultTransferRequestAggregateRoot,
    VaultTransferRequestFactory,
    VaultTransferRequestDescription,
    VaultTransferRequestDecision
} from '../model/vaulttransferrequest.model.js';
import { components } from './components.js';
import { NotificationService } from "../services/notification.service.js";
import { DirectoryService } from "../services/directory.service.js";
import { ProtectionRequestDescription, ProtectionRequestRepository } from '../model/protectionrequest.model.js';
import { VaultTransferRequestService } from '../services/vaulttransferrequest.service.js';
import { LocalsObject } from 'pug';
import { UserPrivateData } from "./adapters/locrequestadapter.js";
import { LocRequestAggregateRoot, LocRequestRepository } from '../model/locrequest.model.js';
import { TypesRecoveryConfig } from '@logion/node-api';

type CreateVaultTransferRequestView = components["schemas"]["CreateVaultTransferRequestView"];
type VaultTransferRequestView = components["schemas"]["VaultTransferRequestView"];
type FetchVaultTransferRequestsSpecificationView = components["schemas"]["FetchVaultTransferRequestsSpecificationView"];
type FetchVaultTransferRequestsResponseView = components["schemas"]["FetchVaultTransferRequestsResponseView"];
type RejectVaultTransferRequestView = components["schemas"]["RejectVaultTransferRequestView"];

const { logger } = Log;

export function fillInSpec(spec: OpenAPIV3.Document): void {
    const tagName = 'Vault Transfer Requests';
    addTag(spec, {
        name: tagName,
        description: "Handling of Vault Transfer Requests"
    });
    setControllerTag(spec, /^\/api\/vault-transfer-request.*/, tagName);

    VaultTransferRequestController.createVaultTransferRequest(spec);
    VaultTransferRequestController.fetchVaultTransferRequests(spec);
    VaultTransferRequestController.rejectVaultTransferRequest(spec);
    VaultTransferRequestController.acceptVaultTransferRequest(spec);
}

interface UserData {
    requesterAddress: string;
    userPrivateData: UserPrivateData;
    activeRecovery?: ProtectionRequestDescription;
    activeProtection?: TypesRecoveryConfig;
}

@injectable()
@Controller('/vault-transfer-request')
export class VaultTransferRequestController extends ApiController {

    constructor(
        private vaultTransferRequestRepository: VaultTransferRequestRepository,
        private vaultTransferRequestFactory: VaultTransferRequestFactory,
        private authenticationService: AuthenticationService,
        private notificationService: NotificationService,
        private directoryService: DirectoryService,
        private protectionRequestRepository: ProtectionRequestRepository,
        private vaultTransferRequestService: VaultTransferRequestService,
        private polkadotService: PolkadotService,
        private locRequestRepository: LocRequestRepository,
    ) {
        super();
    }

    static createVaultTransferRequest(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/vault-transfer-request"].post!;
        operationObject.summary = "Creates a new Vault Transfer Request";
        operationObject.description = "The authenticated user must be the vault transfer requester";
        operationObject.requestBody = getRequestBody({
            description: "Vault transfer request creation data",
            view: "CreateVaultTransferRequestView",
        });
        operationObject.responses = getDefaultResponses("VaultTransferRequestView");
    }

    @Async()
    @HttpPost('')
    async createVaultTransferRequest(body: CreateVaultTransferRequestView): Promise<VaultTransferRequestView> {
        const origin = requireDefined(body.origin, () => badRequest("Missing origin"))
        const legalOfficerAddress = await this.directoryService.requireLegalOfficerAddressOnNode(body.legalOfficerAddress);
        const protectionRequestDescription = await this.userAuthorizedAndProtected(origin, legalOfficerAddress);

        const request = this.vaultTransferRequestFactory.newVaultTransferRequest({
            id: uuid(),
            requesterAddress: protectionRequestDescription.requesterAddress,
            legalOfficerAddress,
            createdOn: moment().toISOString(),
            amount: BigInt(body.amount!),
            origin,
            destination: body.destination!,
            timepoint: {
                blockNumber: BigInt(body.block!),
                extrinsicIndex: body.index!
            },
        });

        await this.vaultTransferRequestService.add(request);

        this.getNotificationInfo(request.getDescription(), protectionRequestDescription.userPrivateData)
            .then(info => this.notificationService.notify(info.legalOfficerEmail, "vault-transfer-requested", info.data))
            .catch(error => logger.error(error));

        return this.adapt(request, protectionRequestDescription.userPrivateData);
    }

    private async userAuthorizedAndProtected(origin: string, legalOfficerAddress: string): Promise<UserData> {
        const user = await this.authenticationService.authenticatedUser(this.request);
        const data = await this.getProtectionAndRecoveryData(user.address, origin, legalOfficerAddress);

        user.require(user =>
            user.address === origin ||
            data.activeRecovery !== undefined && origin === data.activeRecovery.addressToRecover);

        return this.getUserDataFromProtection(user.address, origin, legalOfficerAddress, data.activeRecovery, data.activeProtection);
    }

    private async getProtectionAndRecoveryData(requester: string, origin: string, legalOfficerAddress: string): Promise<{
        activeRecovery?: ProtectionRequestDescription,
        activeProtection?: TypesRecoveryConfig,
    }> {
        const activeRecovery = await this.findActiveRecovery(requester, legalOfficerAddress);
        const api = await this.polkadotService.readyApi();
        const activeProtection = await api.queries.getRecoveryConfig(origin);

        if(!activeRecovery && !activeProtection) {
            throw badRequest("Requester is not protected");
        }

        return { activeProtection, activeRecovery };
    }

    private async getUserData(requester: string, origin: string, legalOfficerAddress: string): Promise<UserData> {
        const data = await this.getProtectionAndRecoveryData(requester, origin, legalOfficerAddress);
        return this.getUserDataFromProtection(requester, origin, legalOfficerAddress, data.activeRecovery, data.activeProtection);
    }

    private async getUserDataFromProtection(
        requester: string,
        origin: string,
        legalOfficerAddress: string,
        activeRecovery?: ProtectionRequestDescription,
        activeProtection?: TypesRecoveryConfig,
    ): Promise<UserData> {
        if(!activeRecovery && !activeProtection) {
            throw badRequest("Requester is not protected");
        }

        let identityLoc: LocRequestAggregateRoot;
        if(activeRecovery) {
            identityLoc = requireDefined(await this.locRequestRepository.findById(activeRecovery.requesterIdentityLocId));
        } else {
            identityLoc = requireDefined(await this.locRequestRepository.getValidPolkadotIdentityLoc({
                address: origin,
                type: "Polkadot",
            }, legalOfficerAddress));
        }

        const description = identityLoc.getDescription();
        return {
            requesterAddress: requester,
            userPrivateData: {
                identityLocId: requireDefined(identityLoc.id),
                userIdentity: description.userIdentity,
                userPostalAddress: description.userPostalAddress,
            },
            activeProtection,
            activeRecovery,
        };
    }

    private async findActiveRecovery(requesterAddress: string, legalOfficerAddress: string): Promise<ProtectionRequestDescription | undefined> {
        const protectionRequests = await this.protectionRequestRepository.findBy({
            expectedRequesterAddress: requesterAddress,
            expectedLegalOfficerAddress: legalOfficerAddress,
            expectedStatuses: [ 'ACTIVATED' ],
            kind: 'RECOVERY'
        });

        if(protectionRequests.length === 0) {
            return undefined;
        } else {
            return protectionRequests[0].getDescription();
        }
    }

    private async getNotificationInfo(
        vaultTransfer: VaultTransferRequestDescription,
        userPrivateData: UserPrivateData,
        decision?: VaultTransferRequestDecision
    ): Promise<{ legalOfficerEmail: string, userEmail: string | undefined, data: LocalsObject }> {

        const legalOfficer = await this.directoryService.get(vaultTransfer.legalOfficerAddress);
        const { userIdentity, userPostalAddress } = userPrivateData;
        return {
            legalOfficerEmail: legalOfficer.userIdentity.email,
            userEmail: userIdentity?.email,
            data: {
                vaultTransfer: { ...vaultTransfer, decision },
                legalOfficer,
                walletUser: userIdentity,
                walletUserPostalAddress: userPostalAddress,
            }
        }
    }

    static fetchVaultTransferRequests(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/vault-transfer-request"].put!;
        operationObject.summary = "Lists Vault Transfer Requests based on a given specification";
        operationObject.description = "The authenticated user must be either the requester or a LLO operating on the current node.";
        operationObject.requestBody = getRequestBody({
            description: "The specification for fetching Vault Transfer Requests",
            view: "FetchVaultTransferRequestsSpecificationView",
        });
        operationObject.responses = getDefaultResponses("FetchVaultTransferRequestsResponseView");
    }

    @Async()
    @HttpPut('')
    async fetchVaultTransferRequests(body: FetchVaultTransferRequestsSpecificationView): Promise<FetchVaultTransferRequestsResponseView> {
        const authenticatedUser = await this.authenticationService.authenticatedUser(this.request);
        authenticatedUser.require(user => user.isOneOf([ body.legalOfficerAddress, body.requesterAddress ]));
        const specification = new FetchVaultTransferRequestsSpecification({
            expectedRequesterAddress: body.requesterAddress,
            expectedLegalOfficerAddress: body.legalOfficerAddress,
            expectedStatuses: body.statuses,
        });

        const vaultTransferRequests = await this.vaultTransferRequestRepository.findBy(specification);
        const protectionDescriptions: Record<string, UserData> = {};
        for(let i = 0; i < vaultTransferRequests.length; ++i) {
            const request = vaultTransferRequests[i].getDescription();
            protectionDescriptions[request.requesterAddress!] ||= await this.getUserData(
                request.requesterAddress,
                request.origin,
                request.legalOfficerAddress
            );
        }

        const requests = vaultTransferRequests.map(request => {
            const protectionDescription = protectionDescriptions[request.requesterAddress!];
            return this.adapt(request, protectionDescription.userPrivateData);
        });
        return { requests };
    }

    adapt(request: VaultTransferRequestAggregateRoot, userPrivateData: UserPrivateData): VaultTransferRequestView {
        const description = request.getDescription();
        return {
            id: description.id,
            createdOn: description.createdOn,
            amount: description.amount.toString(),
            origin: description.origin,
            destination: description.destination,
            block: description.timepoint.blockNumber.toString(),
            index: description.timepoint.extrinsicIndex,
            decision: {
                rejectReason: request.decision!.rejectReason || "",
                decisionOn: request.decision!.decisionOn || undefined,
            },
            status: request.status!,
            requesterIdentity: userPrivateData.userIdentity,
            requesterPostalAddress: userPrivateData.userPostalAddress,
        };
    }

    static rejectVaultTransferRequest(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/vault-transfer-request/{id}/reject"].post!;
        operationObject.summary = "Rejects a Vault Transfer Request";
        operationObject.description = "The authenticated user must be a LLO operating on the current node";
        operationObject.requestBody = getRequestBody({
            description: "Vault Transfer Request rejection data",
            view: "RejectVaultTransferRequestView",
        });
        operationObject.responses = getDefaultResponses("VaultTransferRequestView");
        setPathParameters(operationObject, { 'id': "The ID of the request to reject" });
    }

    @Async()
    @HttpPost('/:id/reject')
    async rejectVaultTransferRequest(body: RejectVaultTransferRequestView, id: string): Promise<VaultTransferRequestView> {
        const authenticatedUser = await this.authenticationService.authenticatedUserIsLegalOfficerOnNode(this.request);
        const request = await this.vaultTransferRequestService.update(id, async request => {
            authenticatedUser.require(user => user.is(request.legalOfficerAddress))
            request.reject(body.rejectReason!, moment());
        });

        const description = request.getDescription();
        const protectionRequestDescription = await this.getUserData(description.requesterAddress, description.origin, description.legalOfficerAddress);
        this.getNotificationInfo(request.getDescription(), protectionRequestDescription.userPrivateData, request.decision)
            .then(info => this.notificationService.notify(info.userEmail, "vault-transfer-rejected", info.data))
            .catch(error => logger.error(error));

        return this.adapt(request, protectionRequestDescription.userPrivateData);
    }

    static acceptVaultTransferRequest(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/vault-transfer-request/{id}/accept"].post!;
        operationObject.summary = "Accepts a Vault Transfer Request";
        operationObject.description = "The authenticated user must be a LLO operating on the current node";
        operationObject.requestBody = getRequestBody({
            description: "Protection Request acceptance data",
            view: "AcceptVaultTransferRequestView",
        });
        operationObject.responses = getDefaultResponses("VaultTransferRequestView");
        setPathParameters(operationObject, { 'id': "The ID of the request to accept" });
    }

    @Async()
    @HttpPost('/:id/accept')
    async acceptVaultTransferRequest(_body: never, id: string): Promise<VaultTransferRequestView> {
        const authenticatedUser = await this.authenticationService.authenticatedUserIsLegalOfficerOnNode(this.request);
        const request = await this.vaultTransferRequestService.update(id, async request => {
            authenticatedUser.require(user => user.is(request.legalOfficerAddress))
            request.accept(moment());
        });

        const description = request.getDescription();
        const protectionRequestDescription = await this.getUserData(description.requesterAddress, description.origin, description.legalOfficerAddress);
        this.getNotificationInfo(request.getDescription(), protectionRequestDescription.userPrivateData, request.decision)
            .then(info => this.notificationService.notify(info.userEmail, "vault-transfer-accepted", info.data))
            .catch(error => logger.error(error));

        return this.adapt(request, protectionRequestDescription.userPrivateData);
    }

    @Async()
    @HttpPost('/:id/cancel')
    async cancelVaultTransferRequest(_body: never, id: string): Promise<VaultTransferRequestView> {
        const authenticatedUser = await this.authenticationService.authenticatedUser(this.request);

        const request = await this.vaultTransferRequestService.update(id, async request => {
            authenticatedUser.require(user => user.address === request.getDescription().requesterAddress);
            request.cancel(moment());
        });

        const description = request.getDescription();
        const protectionRequestDescription = await this.getUserData(description.requesterAddress, description.origin, description.legalOfficerAddress);
        this.getNotificationInfo(request.getDescription(), protectionRequestDescription.userPrivateData, request.decision)
            .then(info => this.notificationService.notify(info.legalOfficerEmail, "vault-transfer-cancelled", info.data))
            .catch(error => logger.error(error));

        return this.adapt(request, protectionRequestDescription.userPrivateData);
    }

    @Async()
    @HttpPost('/:id/resubmit')
    async resubmitVaultTransferRequest(_body: never, id: string): Promise<VaultTransferRequestView> {
        const authenticatedUser = await this.authenticationService.authenticatedUser(this.request);

        const request = await this.vaultTransferRequestService.update(id, async request => {
            authenticatedUser.require(user => user.address === request.getDescription().requesterAddress);
            request.resubmit();
        });

        const description = request.getDescription();
        const protectionRequestDescription = await this.getUserData(description.requesterAddress, description.origin, description.legalOfficerAddress);
        this.getNotificationInfo(request.getDescription(), protectionRequestDescription.userPrivateData, request.decision)
            .then(info => this.notificationService.notify(info.legalOfficerEmail, "vault-transfer-requested", info.data))
            .catch(error => logger.error(error));

        return this.adapt(request, protectionRequestDescription.userPrivateData);
    }
}
