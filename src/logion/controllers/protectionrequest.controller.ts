import { injectable } from 'inversify';
import { ApiController, Controller, HttpPost, HttpPut, Async } from 'dinoloop';
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

import { addTag, setControllerTag, getRequestBody, getDefaultResponses, setPathParameters } from './doc';
import { requireDefined } from '../lib/assertions';
import { AuthenticationService } from "../services/authentication.service";

type CreateProtectionRequestView = components["schemas"]["CreateProtectionRequestView"];
type ProtectionRequestView = components["schemas"]["ProtectionRequestView"];
type FetchProtectionRequestsSpecificationView = components["schemas"]["FetchProtectionRequestsSpecificationView"];
type FetchProtectionRequestsResponseView = components["schemas"]["FetchProtectionRequestsResponseView"];
type RejectProtectionRequestView = components["schemas"]["RejectProtectionRequestView"];
type AcceptProtectionRequestView = components["schemas"]["AcceptProtectionRequestView"];
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
    ProtectionRequestController.fetchRecoveryInfo(spec);
}

@injectable()
@Controller('/protection-request')
export class ProtectionRequestController extends ApiController {

    constructor(
        private protectionRequestRepository: ProtectionRequestRepository,
        private protectionRequestFactory: ProtectionRequestFactory,
        private authenticationService: AuthenticationService) {
        super();
    }

    static createProtectionRequests(spec: OpenAPIV3.Document) {
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
    async createProtectionRequests(body: CreateProtectionRequestView): Promise<ProtectionRequestView> {
        this.authenticationService.authenticatedUserIs(this.request, body.requesterAddress);
        const request = this.protectionRequestFactory.newProtectionRequest({
            id: uuid(),
            description: {
                requesterAddress: body.requesterAddress!,
                otherLegalOfficerAddress: body.otherLegalOfficerAddress!,
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
        });

        await this.protectionRequestRepository.save(request);

        return this.adapt(request);
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
        this.authenticationService.authenticatedUserIsOneOf(this.request,
            body.requesterAddress,
            this.authenticationService.nodeOwner);
        const specification = new FetchProtectionRequestsSpecification({
            expectedRequesterAddress: body.requesterAddress,
            expectedStatuses: body.statuses,
            kind: body.kind,
        });
        const protectionRequests = await this.protectionRequestRepository.findBy(specification);
        return {
            requests: protectionRequests.map(request => this.adapt(request))
        };
    }

    adapt(request: ProtectionRequestAggregateRoot): ProtectionRequestView {
        return {
            id: request.id!,
            requesterAddress: request.requesterAddress || "",
            legalOfficerAddress: this.authenticationService.nodeOwner,
            otherLegalOfficerAddress: request.otherLegalOfficerAddress || "",
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
        this.authenticationService.authenticatedUser(this.request)
            .require(user => user.isNodeOwner());
        const request = requireDefined(await this.protectionRequestRepository.findById(id));
        request.reject(body.rejectReason!, moment());
        await this.protectionRequestRepository.save(request);
        return this.adapt(request);
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
        this.authenticationService.authenticatedUser(this.request)
            .require(user => user.isNodeOwner());
        if(body.locId === undefined || body.locId === null) {
            throw new Error("Missing LOC ID");
        }
        const request = requireDefined(await this.protectionRequestRepository.findById(id));
        request.accept(moment(), body.locId!);
        await this.protectionRequestRepository.save(request);
        return this.adapt(request);
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
    async fetchRecoveryInfo(_body: any, id: string): Promise<RecoveryInfoView> {
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
            expectedStatuses: [ 'ACTIVATED' ]
        });
        const protectionRequests = await this.protectionRequestRepository.findBy(querySpecification);
        if (protectionRequests.length === 0) {
            throw new Error("Activated protection request to recover not found");
        }
        let authorizeUsers = [ this.authenticationService.nodeOwner ];
        if(protectionRequests[0].addressToRecover) {
            authorizeUsers.push(protectionRequests[0].addressToRecover);
        }
        authorizeUsers.push(protectionRequests[0].requesterAddress!);
        this.authenticationService.authenticatedUserIsOneOf(this.request, ...authorizeUsers)
        return {
            recoveryAccount: this.adapt(recovery),
            accountToRecover: this.adapt(protectionRequests[0]),
        };
    }
}
