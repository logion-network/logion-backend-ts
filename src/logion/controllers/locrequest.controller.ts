import { injectable } from "inversify";
import { Controller, ApiController, HttpPost, Async, HttpPut } from "dinoloop";
import { components } from "./components";
import { v4 as uuid } from "uuid";
import moment from "moment";
import {
    LocRequestRepository,
    LocRequestFactory,
    LocRequestDescription,
    LocRequestAggregateRoot,
    FetchLocRequestsSpecification
} from "../model/locrequest.model";
import { OpenAPIV3 } from "express-oas-generator";
import {
    getRequestBody,
    getDefaultResponses,
    addTag,
    setControllerTag,
    getDefaultResponsesNoContent,
    addPathParameter
} from "./doc";
import { AuthenticationService } from "../services/authentication.service";
import { requireDefined } from "../lib/assertions";
import { UserIdentity } from "../model/useridentity";
import { ProtectionRequestRepository, FetchProtectionRequestsSpecification } from "../model/protectionrequest.model";

export function fillInSpec(spec: OpenAPIV3.Document): void {
    const tagName = 'LOC Requests';
    addTag(spec, {
        name: tagName,
        description: "Handling of LOC Requests"
    });
    setControllerTag(spec, /^\/api\/loc-request.*/, tagName);

    LocRequestController.createLocRequest(spec);
    LocRequestController.fetchRequests(spec);
    LocRequestController.rejectLocRequest(spec);
    LocRequestController.acceptLocRequest(spec);
}

type CreateLocRequestView = components["schemas"]["CreateLocRequestView"];
type LocRequestView = components["schemas"]["LocRequestView"];
type FetchLocRequestsSpecificationView = components["schemas"]["FetchLocRequestsSpecificationView"];
type FetchLocRequestsResponseView = components["schemas"]["FetchLocRequestsResponseView"];
type RejectLocRequestView = components["schemas"]["RejectLocRequestView"];
type UserIdentityView = components["schemas"]["UserIdentityView"];

@injectable()
@Controller('/loc-request')
export class LocRequestController extends ApiController {

    constructor(
        private locRequestRepository: LocRequestRepository,
        private locRequestFactory: LocRequestFactory,
        private authenticationService: AuthenticationService,
        private protectionRequestRepository: ProtectionRequestRepository) {
        super();
    }

    static createLocRequest(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request"].post!;
        operationObject.summary = "Creates a new LOC Request";
        operationObject.description = "The authenticated user must be the requester";
        operationObject.requestBody = getRequestBody({
            description: "LOC Request creation data",
            view: "CreateLocRequestView",
        });
        operationObject.responses = getDefaultResponses("LocRequestView");
    }

    @HttpPost('')
    @Async()
    async createLocRequest(createLocRequestView: CreateLocRequestView): Promise<LocRequestView> {
        this.authenticationService.authenticatedUserIs(this.request, createLocRequestView.requesterAddress);
        const description: LocRequestDescription = {
            requesterAddress: requireDefined(createLocRequestView.requesterAddress),
            ownerAddress: requireDefined(createLocRequestView.ownerAddress),
            description: requireDefined(createLocRequestView.description),
            createdOn: moment().toISOString(),
            userIdentity: this.fromUserView(createLocRequestView.userIdentity)
        }
        let request = this.locRequestFactory.newLocRequest({
            id: uuid(),
            description
        });
        await this.locRequestRepository.save(request);
        const userIdentity = await this.findUserIdentity(request);
        return this.toView(request, userIdentity);
    }

    private toView(request: LocRequestAggregateRoot, userIdentity: UserIdentity | undefined): LocRequestView {
        const locDescription = request.getDescription();
        return {
            id: request.id,
            requesterAddress: locDescription.requesterAddress,
            ownerAddress: locDescription.ownerAddress,
            description: locDescription.description,
            userIdentity: this.toUserView(userIdentity),
            createdOn: locDescription.createdOn || undefined,
            status: request.status,
            rejectReason: request.rejectReason || undefined,
            decisionOn: request.decisionOn || undefined
        }
    }

    private toUserView(userIdentity: UserIdentity | undefined): UserIdentityView | undefined {
        if (userIdentity === undefined) {
            return undefined;
        }
        return {
            firstName: userIdentity.firstName,
            lastName: userIdentity.lastName,
            email: userIdentity.email,
            phoneNumber: userIdentity.phoneNumber,
        }
    }

    private fromUserView(userIdentityView: UserIdentityView | undefined): UserIdentity | undefined {
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
        this.authenticationService.authenticatedUserIsOneOf(this.request, specificationView.requesterAddress, specificationView.ownerAddress)
        const specification: FetchLocRequestsSpecification = {
            expectedRequesterAddress: specificationView.requesterAddress,
            expectedOwnerAddress: specificationView.ownerAddress,
            expectedStatuses: requireDefined(specificationView.statuses),
        }
        const requests = Promise.all((await this.locRequestRepository.findBy(specification)).map(async request => {
            const userIdentity = await this.findUserIdentity(request);
            return this.toView(request, userIdentity);
        }));
        return requests.then(requestViews => Promise.resolve({requests: requestViews}))
    }

    private async findUserIdentity(request: LocRequestAggregateRoot): Promise<UserIdentity | undefined> {
        const description = request.getDescription();
        const protections = await this.protectionRequestRepository.findBy(new FetchProtectionRequestsSpecification({
            expectedDecisionStatuses: [ "ACCEPTED" ],
            kind: "ANY",
            expectedRequesterAddress: description.requesterAddress,
            expectedLegalOfficer: description.ownerAddress
        }));
        if (protections.length > 0) {
            return protections[0].getDescription().userIdentity;
        } else {
            return request.getDescription().userIdentity;
        }
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
        addPathParameter(operationObject, 'requestId', "The ID of the LOC request to reject");
    }

    @HttpPost('/:requestId/reject')
    @Async()
    async rejectLocRequest(rejectLocRequestView: RejectLocRequestView, requestId: string) {
        const request = requireDefined(await this.locRequestRepository.findById(requestId));
        this.authenticationService.authenticatedUserIs(this.request, request.ownerAddress)
            .requireLegalOfficer();
        request.reject(rejectLocRequestView.rejectReason!, moment());
        await this.locRequestRepository.save(request)
    }

    static acceptLocRequest(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/{requestId}/accept"].post!;
        operationObject.summary = "Accepts a LOC Request";
        operationObject.description = "The authenticated user must be the owner of the LOC.";
        operationObject.responses = getDefaultResponsesNoContent();
        addPathParameter(operationObject, 'requestId', "The ID of the LOC request to reject");
    }

    @HttpPost('/:requestId/accept')
    @Async()
    async acceptLocRequest(ignoredBody: any, requestId: string) {
        const request = requireDefined(await this.locRequestRepository.findById(requestId));
        this.authenticationService.authenticatedUserIs(this.request, request.ownerAddress)
            .requireLegalOfficer();
        request.accept(moment());
        await this.locRequestRepository.save(request)
    }

}
