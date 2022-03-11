import { injectable } from 'inversify';
import { ApiController, Controller, HttpPost, HttpPut, Async } from 'dinoloop';
import { v4 as uuid } from 'uuid';
import moment from 'moment';
import { OpenAPIV3 } from 'express-oas-generator';
import { Log } from "../util/Log";

const { logger } = Log;

import {
    VaultTransferRequestRepository,
    FetchVaultTransferRequestsSpecification,
    VaultTransferRequestAggregateRoot,
    VaultTransferRequestFactory, VaultTransferRequestDescription, VaultTransferRequestDecision
} from '../model/vaulttransferrequest.model';

import { components } from './components';

import { addTag, setControllerTag, getRequestBody, getDefaultResponses, setPathParameters } from './doc';
import { requireDefined } from '../lib/assertions';
import { AuthenticationService } from "../services/authentication.service";
import { NotificationService } from "../services/notification.service";
import { DirectoryService } from "../services/directory.service";
import { ProtectionRequestRepository } from '../model/protectionrequest.model';
import { badRequest } from './errors';

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
        private protectionRequestRepository: ProtectionRequestRepository) {
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
        this.authenticationService.authenticatedUserIs(this.request, body.requesterAddress);
        const request = this.vaultTransferRequestFactory.newVaultTransferRequest({
            id: uuid(),
            requesterAddress: body.requesterAddress!,
            createdOn: moment().toISOString(),
            amount: BigInt(body.amount!),
            destination: body.destination!,
            timepoint: {
                blockNumber: BigInt(body.block!),
                extrinsicIndex: body.index!
            }
        });

        await this.vaultTransferRequestRepository.save(request);

        this.getNotificationInfo(request.getDescription())
            .then(info => this.notificationService.notify(info.legalOfficerEmail, "vault-transfer-requested", info.data))
            .catch(error => logger.error(error));

        return this.adapt(request);
    }

    private async getNotificationInfo(vaultTransfer: VaultTransferRequestDescription, decision?: VaultTransferRequestDecision):
        Promise<{ legalOfficerEmail: string, userEmail: string, data: any }> {

        const legalOfficer = await this.directoryService.get(this.ownerAddress);
        const protectionRequests = await this.protectionRequestRepository.findBy({
            expectedRequesterAddress: vaultTransfer.requesterAddress,
            expectedStatuses: [ 'ACTIVATED' ],
            kind: 'ANY'
        });

        if(protectionRequests.length === 0) {
            throw badRequest("Requester is not protected");
        }

        const protectionRequestDescription = protectionRequests[0].getDescription();
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
        this.authenticationService.authenticatedUserIsOneOf(this.request,
            body.requesterAddress,
            this.authenticationService.nodeOwner);
        const specification = new FetchVaultTransferRequestsSpecification({
            expectedRequesterAddress: body.requesterAddress,
            expectedStatuses: body.statuses,
        });
        const vaultTransferRequests = await this.vaultTransferRequestRepository.findBy(specification);
        return {
            requests: vaultTransferRequests.map(request => this.adapt(request))
        };
    }

    adapt(request: VaultTransferRequestAggregateRoot): VaultTransferRequestView {
        const description = request.getDescription();
        return {
            id: description.id,
            createdOn: description.createdOn,
            requesterAddress: description.requesterAddress,
            amount: description.amount.toString(),
            destination: description.destination,
            block: description.timepoint.blockNumber.toString(),
            index: description.timepoint.extrinsicIndex,
            decision: {
                rejectReason: request.decision!.rejectReason || "",
                decisionOn: request.decision!.decisionOn || undefined,
            },
            status: request.status!,
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
        this.authenticationService.authenticatedUser(this.request)
            .require(user => user.isNodeOwner());

        const request = requireDefined(await this.vaultTransferRequestRepository.findById(id));
        request.reject(body.rejectReason!, moment());
        await this.vaultTransferRequestRepository.save(request);

        this.getNotificationInfo(request.getDescription(), request.decision)
            .then(info => this.notificationService.notify(info.userEmail, "vault-transfer-rejected", info.data))
            .catch(error => logger.error(error));

        return this.adapt(request);
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
        this.authenticationService.authenticatedUser(this.request)
            .require(user => user.isNodeOwner());
        const request = requireDefined(await this.vaultTransferRequestRepository.findById(id));
        request.accept(moment());
        await this.vaultTransferRequestRepository.save(request);
        this.getNotificationInfo(request.getDescription(), request.decision)
            .then(info => this.notificationService.notify(info.userEmail, "vault-transfer-accepted", info.data))
            .catch(error => logger.error(error));
        return this.adapt(request);
    }

    @Async()
    @HttpPost('/:id/cancel')
    async cancelVaultTransferRequest(_body: any, id: string): Promise<VaultTransferRequestView> {
        const request = requireDefined(await this.vaultTransferRequestRepository.findById(id));
        this.authenticationService.authenticatedUser(this.request)
            .require(user => user.address === request.getDescription().requesterAddress);

        request.cancel(moment());
        await this.vaultTransferRequestRepository.save(request);

        this.getNotificationInfo(request.getDescription(), request.decision)
            .then(info => this.notificationService.notify(info.legalOfficerEmail, "vault-transfer-cancelled", info.data))
            .catch(error => logger.error(error));

        return this.adapt(request);
    }
}
