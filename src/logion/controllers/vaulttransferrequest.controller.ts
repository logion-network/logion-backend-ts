import { injectable } from 'inversify';
import { ApiController, Controller, HttpPost, HttpPut, Async } from 'dinoloop';
import { v4 as uuid } from 'uuid';
import moment from 'moment';
import { OpenAPIV3 } from 'express-oas-generator';
import {
    Log,
    addTag, setControllerTag, getRequestBody, getDefaultResponses, setPathParameters,
    requireDefined,
    badRequest,
    AuthenticationService,
} from "@logion/rest-api-core";

const { logger } = Log;

import {
    VaultTransferRequestRepository,
    FetchVaultTransferRequestsSpecification,
    VaultTransferRequestAggregateRoot,
    VaultTransferRequestFactory, VaultTransferRequestDescription, VaultTransferRequestDecision
} from '../model/vaulttransferrequest.model';
import { components } from './components';
import { NotificationService } from "../services/notification.service";
import { DirectoryService } from "../services/directory.service";
import { ProtectionRequestDescription, ProtectionRequestRepository } from '../model/protectionrequest.model';
import { VaultTransferRequestService } from '../services/vaulttransferrequest.service';

type CreateVaultTransferRequestView = components["schemas"]["CreateVaultTransferRequestView"];
type VaultTransferRequestView = components["schemas"]["VaultTransferRequestView"];
type FetchVaultTransferRequestsSpecificationView = components["schemas"]["FetchVaultTransferRequestsSpecificationView"];
type FetchVaultTransferRequestsResponseView = components["schemas"]["FetchVaultTransferRequestsResponseView"];
type RejectVaultTransferRequestView = components["schemas"]["RejectVaultTransferRequestView"];

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
    ) {
        super();
    }

    private readonly ownerAddress: string = process.env.OWNER!

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
        const protectionRequestDescription = await this.userAuthorizedAndProtected(origin)

        const request = this.vaultTransferRequestFactory.newVaultTransferRequest({
            id: uuid(),
            requesterAddress: protectionRequestDescription.requesterAddress,
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

        this.getNotificationInfo(request.getDescription(), protectionRequestDescription)
            .then(info => this.notificationService.notify(info.legalOfficerEmail, "vault-transfer-requested", info.data))
            .catch(error => logger.error(error));

        return this.adapt(request, protectionRequestDescription);
    }

    private async userAuthorizedAndProtected(origin: string): Promise<ProtectionRequestDescription> {
        const user = await this.authenticationService.authenticatedUser(this.request);
        const protectionRequestDescription = await this.getProtectionRequestDescription(user.address);
        user.require(user =>
            user.address === origin ||
            origin === protectionRequestDescription.addressToRecover)
        return protectionRequestDescription
    }

    private async getProtectionRequestDescription(requesterAddress: string): Promise<ProtectionRequestDescription> {
        const protectionRequests = await this.protectionRequestRepository.findBy({
            expectedRequesterAddress: requesterAddress,
            expectedStatuses: [ 'ACTIVATED' ],
            kind: 'ANY'
        });

        if(protectionRequests.length === 0) {
            throw badRequest("Requester is not protected");
        }

        return protectionRequests[0].getDescription();
    }

    private async getNotificationInfo(
        vaultTransfer: VaultTransferRequestDescription,
        protectionRequestDescription: ProtectionRequestDescription,
        decision?: VaultTransferRequestDecision
    ): Promise<{ legalOfficerEmail: string, userEmail: string, data: any }> {

        const legalOfficer = await this.directoryService.get(this.ownerAddress);
        return {
            legalOfficerEmail: legalOfficer.userIdentity.email,
            userEmail: protectionRequestDescription.userIdentity.email,
            data: {
                vaultTransfer: { ...vaultTransfer, decision },
                legalOfficer,
                walletUser: protectionRequestDescription.userIdentity,
                walletUserPostalAddress: protectionRequestDescription.userPostalAddress,
            }
        }
    }

    static fetchVaultTransferRequests(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/vault-transfer-request"].put!;
        operationObject.summary = "Lists Vault Transfer Requests based on a given specification";
        operationObject.description = "The authenticated user must be either the requester or the node owner.";
        operationObject.requestBody = getRequestBody({
            description: "The specification for fetching Vault Transfer Requests",
            view: "FetchVaultTransferRequestsSpecificationView",
        });
        operationObject.responses = getDefaultResponses("FetchVaultTransferRequestsResponseView");
    }

    @Async()
    @HttpPut('')
    async fetchVaultTransferRequests(body: FetchVaultTransferRequestsSpecificationView): Promise<FetchVaultTransferRequestsResponseView> {
        await this.authenticationService.authenticatedUserIsOneOf(this.request,
            body.requesterAddress,
            this.authenticationService.nodeOwner);
        const specification = new FetchVaultTransferRequestsSpecification({
            expectedRequesterAddress: body.requesterAddress,
            expectedStatuses: body.statuses,
        });

        const vaultTransferRequests = await this.vaultTransferRequestRepository.findBy(specification);
        const protectionDescriptions: Record<string, ProtectionRequestDescription> = {};
        for(let i = 0; i < vaultTransferRequests.length; ++i) {
            const request = vaultTransferRequests[i];
            protectionDescriptions[request.requesterAddress!] ||= await this.getProtectionRequestDescription(request.requesterAddress!);
        }

        return {
            requests: vaultTransferRequests.map(request => this.adapt(request, protectionDescriptions[request.requesterAddress!]))
        };
    }

    adapt(request: VaultTransferRequestAggregateRoot, protectionDescription: ProtectionRequestDescription): VaultTransferRequestView {
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
            requesterIdentity: protectionDescription.userIdentity,
            requesterPostalAddress: protectionDescription.userPostalAddress,
        };
    }

    static rejectVaultTransferRequest(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/vault-transfer-request/{id}/reject"].post!;
        operationObject.summary = "Rejects a Vault Transfer Request";
        operationObject.description = "The authenticated user must be the node owner";
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
        (await this.authenticationService.authenticatedUser(this.request))
            .require(user => user.isNodeOwner());

        const request = await this.vaultTransferRequestService.update(id, async request => {
            request.reject(body.rejectReason!, moment());
        });

        const protectionRequestDescription = await this.getProtectionRequestDescription(request.requesterAddress!);
        this.getNotificationInfo(request.getDescription(), protectionRequestDescription, request.decision)
            .then(info => this.notificationService.notify(info.userEmail, "vault-transfer-rejected", info.data))
            .catch(error => logger.error(error));

        return this.adapt(request, protectionRequestDescription);
    }

    static acceptVaultTransferRequest(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/vault-transfer-request/{id}/accept"].post!;
        operationObject.summary = "Accepts a Vault Transfer Request";
        operationObject.description = "The authenticated user must be the node owner";
        operationObject.requestBody = getRequestBody({
            description: "Protection Request acceptance data",
            view: "AcceptVaultTransferRequestView",
        });
        operationObject.responses = getDefaultResponses("VaultTransferRequestView");
        setPathParameters(operationObject, { 'id': "The ID of the request to accept" });
    }

    @Async()
    @HttpPost('/:id/accept')
    async acceptVaultTransferRequest(_body: any, id: string): Promise<VaultTransferRequestView> {
        (await this.authenticationService.authenticatedUser(this.request))
            .require(user => user.isNodeOwner());

        const request = await this.vaultTransferRequestService.update(id, async request => {
            request.accept(moment());
        });

        const protectionRequestDescription = await this.getProtectionRequestDescription(request.requesterAddress!);
        this.getNotificationInfo(request.getDescription(), protectionRequestDescription, request.decision)
            .then(info => this.notificationService.notify(info.userEmail, "vault-transfer-accepted", info.data))
            .catch(error => logger.error(error));

        return this.adapt(request, protectionRequestDescription);
    }

    @Async()
    @HttpPost('/:id/cancel')
    async cancelVaultTransferRequest(_body: any, id: string): Promise<VaultTransferRequestView> {
        const authenticatedUser = await this.authenticationService.authenticatedUser(this.request);

        const request = await this.vaultTransferRequestService.update(id, async request => {
            authenticatedUser.require(user => user.address === request.getDescription().requesterAddress);
            request.cancel(moment());
        });
            
        const protectionRequestDescription = await this.getProtectionRequestDescription(request.requesterAddress!);
        this.getNotificationInfo(request.getDescription(), protectionRequestDescription, request.decision)
            .then(info => this.notificationService.notify(info.legalOfficerEmail, "vault-transfer-cancelled", info.data))
            .catch(error => logger.error(error));

        return this.adapt(request, protectionRequestDescription);
    }

    @Async()
    @HttpPost('/:id/resubmit')
    async resubmitVaultTransferRequest(_body: any, id: string): Promise<VaultTransferRequestView> {
        const authenticatedUser = await this.authenticationService.authenticatedUser(this.request);

        const request = await this.vaultTransferRequestService.update(id, async request => {
            authenticatedUser.require(user => user.address === request.getDescription().requesterAddress);
            request.resubmit();
        });

        const protectionRequestDescription = await this.getProtectionRequestDescription(request.requesterAddress!);

        this.getNotificationInfo(request.getDescription(), protectionRequestDescription, request.decision)
            .then(info => this.notificationService.notify(info.legalOfficerEmail, "vault-transfer-requested", info.data))
            .catch(error => logger.error(error));

        return this.adapt(request, protectionRequestDescription);
    }
}
