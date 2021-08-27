import { injectable } from 'inversify';
import { ApiController, Controller, HttpPost, HttpPut, Async, BadRequestException } from 'dinoloop';
import { v4 as uuid } from 'uuid';
import moment from 'moment';
import { OpenAPIV3 } from 'express-oas-generator';

import {
    ProtectionRequestRepository,
    FetchProtectionRequestsSpecification,
    ProtectionRequestAggregateRoot,
    ProtectionRequestFactory,
} from '../model/protectionrequest.model';

import { components } from './components';

import { RecoveryService } from '../services/recovery.service';
import { addTag, setControllerTag, getRequestBody, getDefaultResponses, addPathParameter } from './doc';
import { SignatureService } from '../services/signature.service';
import { requireDefined } from '../lib/assertions';

type CreateProtectionRequestView = components["schemas"]["CreateProtectionRequestView"];
type ProtectionRequestView = components["schemas"]["ProtectionRequestView"];
type FetchProtectionRequestsSpecificationView = components["schemas"]["FetchProtectionRequestsSpecificationView"];
type FetchProtectionRequestsResponseView = components["schemas"]["FetchProtectionRequestsResponseView"];
type RejectProtectionRequestView = components["schemas"]["RejectProtectionRequestView"];
type AcceptProtectionRequestView = components["schemas"]["AcceptProtectionRequestView"];
type CheckProtectionSpecificationView = components["schemas"]["CheckProtectionSpecificationView"];
type CheckProtectionResponseView = components["schemas"]["CheckProtectionResponseView"];
type CheckProtectionActivationView = components["schemas"]["CheckProtectionActivationView"];
type RecoveryInfoView = components["schemas"]["RecoveryInfoView"];

export function fillInSpec(spec: OpenAPIV3.Document): void {
    const tagName = 'Protection Requests';
    addTag(spec, {
        name: tagName,
        description: "Handling of Protection Requests"
    });
    setControllerTag(spec, /^\/api\/protection-request.*/, tagName);

    ProtectionRequestController.createProtectionRequests(spec);
    ProtectionRequestController.fetchProtectionRequests(spec);
    ProtectionRequestController.rejectProtectionRequest(spec);
    ProtectionRequestController.acceptProtectionRequest(spec);
    ProtectionRequestController.checkProtection(spec);
    ProtectionRequestController.checkAndSetProtectionRequestActivation(spec);
    ProtectionRequestController.fetchRecoveryInfo(spec);
}

@injectable()
@Controller('/protection-request')
export class ProtectionRequestController extends ApiController {

    static readonly RESOURCE = "protection-request";

    constructor(
        private protectionRequestRepository: ProtectionRequestRepository,
        private protectionRequestFactory: ProtectionRequestFactory,
        private recoveryService: RecoveryService,
        private signatureService: SignatureService) {
        super();
    }

    static createProtectionRequests(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/protection-request"].post!;
        operationObject.summary = "Creates a new Protection Request";
        operationObject.description = "<p>The signature's resource is <code>protection-request</code>, the operation <code>create</code> and the additional fields are:</p><ul><li><code>userIdentity.firstName</code></li><li><code>userIdentity.lastName</code></li><li><code>userIdentity.email</code></li><li><code>userIdentity.phoneNumber</code></li><li><code>userPostalAddress.line1</code></li><li><code>userPostalAddress.line2</code></li><li><code>userPostalAddress.postalCode</code></li><li><code>userPostalAddress.city</code></li><li><code>userPostalAddress.country</code></li><li><code>userPostalAddress.line1</code></li><li><code>legalOfficerAddresses*</code></li></ul><p>where <code>legalOfficerAddresses*</code> is the concatenation of all SS58 addresses from field <code>legalOfficerAddresses</code></p>";
        operationObject.requestBody = getRequestBody({
            description: "Protection request creation data",
            view: "CreateProtectionRequestView",
        });
        operationObject.responses = getDefaultResponses("ProtectionRequestView");
    }

    @Async()
    @HttpPost('')
    async createProtectionRequests(body: CreateProtectionRequestView): Promise<ProtectionRequestView> {
        if(!await this.signatureService.verify({
            signature: requireDefined(body.signature),
            address: requireDefined(body.requesterAddress),
            resource: ProtectionRequestController.RESOURCE,
            operation: "create",
            timestamp: requireDefined(body.signedOn),
            attributes: [
                body.userIdentity!.firstName,
                body.userIdentity!.lastName,
                body.userIdentity!.email,
                body.userIdentity!.phoneNumber,
                body.userPostalAddress!.line1,
                body.userPostalAddress!.line2,
                body.userPostalAddress!.postalCode,
                body.userPostalAddress!.city,
                body.userPostalAddress!.country,
                body.isRecovery,
                body.addressToRecover,
                body.legalOfficerAddresses
            ]
        })) {
            throw new BadRequestException();
        } else {
            const request = this.protectionRequestFactory.newProtectionRequest({
                id: uuid(),
                description: {
                    requesterAddress: body.requesterAddress!,
                    userIdentity: {
                        firstName: body.userIdentity!.firstName!,
                        lastName: body.userIdentity!.lastName!,
                        email: body.userIdentity!.email!,
                        phoneNumber: body.userIdentity!.phoneNumber!,
                    },
                    userPostalAddress: {
                        line1: body.userPostalAddress!.line1!,
                        line2: body.userPostalAddress!.line2!,
                        postalCode: body.userPostalAddress!.postalCode!,
                        city: body.userPostalAddress!.city!,
                        country: body.userPostalAddress!.country!,
                    },
                    createdOn: moment().toISOString(),
                    isRecovery: body.isRecovery!,
                    addressToRecover: body.addressToRecover!,
                },
                legalOfficerAddresses: body.legalOfficerAddresses!,
            });
    
            await this.protectionRequestRepository.save(request);
    
            return this.adapt(request);
        }
    }

    static fetchProtectionRequests(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/protection-request"].put!;
        operationObject.summary = "Lists Protection Requests based on a given specification";
        operationObject.description = "No authentication required yet";
        operationObject.requestBody = getRequestBody({
            description: "The specification for fetching Protection Requests",
            view: "FetchProtectionRequestsSpecificationView",
        });
        operationObject.responses = getDefaultResponses("FetchProtectionRequestsResponseView");
    }

    @Async()
    @HttpPut('')
    async fetchProtectionRequests(body: FetchProtectionRequestsSpecificationView): Promise<FetchProtectionRequestsResponseView> {
        const specification = new FetchProtectionRequestsSpecification({
            expectedRequesterAddress: body.requesterAddress,
            expectedLegalOfficer: body.legalOfficerAddress,
            expectedDecisionStatuses: body.decisionStatuses,
            expectedProtectionRequestStatus: body.protectionRequestStatus,
            kind: body.kind,
        });
        const protectionRequests = await this.protectionRequestRepository.findBy(specification);
        return {
            requests: protectionRequests.map(this.adapt)
        };
    }

    adapt(request: ProtectionRequestAggregateRoot): ProtectionRequestView {
        return {
            id: request.id!,
            requesterAddress: request.requesterAddress || "",
            userIdentity: {
                firstName: request.firstName || "",
                lastName: request.lastName || "",
                email: request.email || "",
                phoneNumber: request.phoneNumber || "",
            },
            userPostalAddress: {
                line1: request.line1 || "",
                line2: request.line2 || "",
                postalCode: request.postalCode || "",
                city: request.city || "",
                country: request.country || "",
            },
            decisions: request.decisions!.map(decision => ({
                legalOfficerAddress: decision.legalOfficerAddress || "",
                status: decision.status!,
                rejectReason: decision.rejectReason || "",
                createdOn: decision.createdOn!,
                decisionOn: decision.decisionOn || undefined,
            })),
            createdOn: request.createdOn!,
            isRecovery: request.isRecovery || false,
            addressToRecover: request.addressToRecover || undefined,
            status: request.status!,
        };
    }

    static rejectProtectionRequest(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/protection-request/{id}/reject"].post!;
        operationObject.summary = "Rejects a Protection Request";
        operationObject.description = "The signature's resource is `protection-request`, the operation `reject` and the additional fields are the `requestId` and the `rejectReason`.";
        operationObject.requestBody = getRequestBody({
            description: "Protection Request rejection data",
            view: "RejectProtectionRequestView",
        });
        operationObject.responses = getDefaultResponses("ProtectionRequestView");
        addPathParameter(operationObject, 'id', "The ID of the request to reject");
    }

    @Async()
    @HttpPost('/:id/reject')
    async rejectProtectionRequest(body: RejectProtectionRequestView, id: string): Promise<ProtectionRequestView> {
        const request = requireDefined(await this.protectionRequestRepository.findById(id));
        if(!await this.signatureService.verify({
            signature: requireDefined(body.signature),
            address: requireDefined(body.legalOfficerAddress),
            resource: ProtectionRequestController.RESOURCE,
            operation: "reject",
            timestamp: requireDefined(body.signedOn),
            attributes: [
                request.id,
                body.rejectReason
            ]
        })) {
            throw new BadRequestException();
        } else {
            request.reject(body.legalOfficerAddress!, body.rejectReason!, moment());
            await this.protectionRequestRepository.save(request);
            return this.adapt(request);
        }
    }

    static acceptProtectionRequest(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/protection-request/{id}/accept"].post!;
        operationObject.summary = "Accepts a Protection Request";
        operationObject.description = "The signature's resource is `protection-request`, the operation `accept` and the additional field is the `requestId`.";
        operationObject.requestBody = getRequestBody({
            description: "Protection Request acceptance data",
            view: "AcceptProtectionRequestView",
        });
        operationObject.responses = getDefaultResponses("ProtectionRequestView");
        addPathParameter(operationObject, 'id', "The ID of the request to accept");
    }

    @Async()
    @HttpPost('/:id/accept')
    async acceptProtectionRequest(body: AcceptProtectionRequestView, id: string): Promise<ProtectionRequestView> {
        const request = requireDefined(await this.protectionRequestRepository.findById(id));
        if(!await this.signatureService.verify({
            signature: requireDefined(body.signature),
            address: requireDefined(body.legalOfficerAddress),
            resource: ProtectionRequestController.RESOURCE,
            operation: "accept",
            timestamp: requireDefined(body.signedOn),
            attributes: [
                request.id,
            ]
        })) {
            throw new BadRequestException();
        } else {
            request.accept(body.legalOfficerAddress!, moment());
            await this.protectionRequestRepository.save(request);
            return this.adapt(request);
        }
    }

    static checkProtection(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/protection-request/check"].put!;
        operationObject.summary = "Checks that the user has submitted a protection request to the legal officer(s), and that the legal officer(s) accepted. The intended user is the chain itself.";
        operationObject.description = "No authentication required";
        operationObject.requestBody = getRequestBody({
            description: "The specification for checking the existence of an accepted protection request",
            view: "CheckProtectionSpecificationView",
        });
        operationObject.responses = getDefaultResponses("CheckProtectionResponseView");
    }

    @Async()
    @HttpPut('/check')
    async checkProtection(body: CheckProtectionSpecificationView): Promise<CheckProtectionResponseView> {
        if (!body.userAddress) {
            return { protection: false };
        }
        if (body.legalOfficerAddresses === null || body.legalOfficerAddresses === undefined || body.legalOfficerAddresses.length === 0) {
            return { protection: false };
        }
        for(let i = 0; i < body.legalOfficerAddresses.length; ++i) {
            const legalOfficerAddress = body.legalOfficerAddresses[i];
            if(!await this._checkProtection(body.userAddress, legalOfficerAddress)) {
                return { protection: false };
            }
        }
        return { protection: true };
    }

    private async _checkProtection(userAddress: string, legalOfficerAddress: string): Promise<boolean> {
        const querySpecification = new FetchProtectionRequestsSpecification({
            expectedRequesterAddress: userAddress,
            expectedLegalOfficer: legalOfficerAddress,
            expectedDecisionStatuses: ['ACCEPTED'],
        });
        const protections = await this.protectionRequestRepository.findBy(querySpecification);
        return protections.length === 0;
    }

    static checkAndSetProtectionRequestActivation(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/protection-request/{id}/check-activation"].post!;
        operationObject.summary = "Checks if a Protection Request is activated on chain, and return the (possibly updated) protection request";
        operationObject.description = "<p>The signature's resource is <code>protection-request</code>, the operation <code>check-activation</code> and the additional fields are the <code>requestId</code>.</p>";
        operationObject.requestBody = getRequestBody({
            description: "The payload, used for signature",
            view: "CheckProtectionActivationView",
        });
        operationObject.responses = getDefaultResponses("ProtectionRequestView");
        addPathParameter(operationObject, 'id', "The ID of the request to check for activation");
    }

    @Async()
    @HttpPost('/:id/check-activation')
    async checkAndSetProtectionRequestActivation(body: CheckProtectionActivationView, id: string): Promise<ProtectionRequestView> {
        const request = requireDefined(await this.protectionRequestRepository.findById(id));
        if(!await this.signatureService.verify({
            signature: requireDefined(body.signature),
            address: requireDefined(body.userAddress),
            resource: ProtectionRequestController.RESOURCE,
            operation: "check-activation",
            timestamp: requireDefined(body.signedOn),
            attributes: [
                request.id,
            ]
        })) {
            throw new BadRequestException();
        } else {
            if(await this.recoveryService.hasRecoveryConfig(body.userAddress!)) {
                request.setActivated();
                await this.protectionRequestRepository.save(request);
            }
    
            return this.adapt(request);
        }
    }

    static fetchRecoveryInfo(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/protection-request/{id}/recovery-info"].put!;
        operationObject.summary = "Fetch all info necessary for the legal officer to accept or reject recovery.";
        operationObject.description = "No authentication required yet";
        operationObject.responses = getDefaultResponses("RecoveryInfoView");
        addPathParameter(operationObject, 'id', "The ID of the recovery request");
    }

    @Async()
    @HttpPut('/:id/recovery-info')
    async fetchRecoveryInfo(body: any, id: string): Promise<RecoveryInfoView> {
        const recovery = await this.protectionRequestRepository.findById(id);
        if(recovery === undefined
            || !recovery.isRecovery
            || recovery.status !== 'PENDING'
            || recovery.addressToRecover === null) {
            throw new Error("Pending recovery request with address to recover not found");
        }

        const addressToRecover = recovery.getDescription().addressToRecover!;
        const querySpecification = new FetchProtectionRequestsSpecification({
            expectedRequesterAddress: addressToRecover,
            expectedProtectionRequestStatus: 'ACTIVATED'
        });
        const protectionRequests = await this.protectionRequestRepository.findBy(querySpecification);
        if (protectionRequests.length === 0) {
            throw new Error("Activated protection request to recover not found");
        }

        return {
            recoveryAccount: this.adapt(recovery),
            accountToRecover: this.adapt(protectionRequests[0]),
        };
    }
}
