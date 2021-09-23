import { injectable } from 'inversify';
import { ApiController, Controller, HttpPost, HttpPut, Async } from 'dinoloop';
import { v4 as uuid } from 'uuid';
import moment from 'moment';
import { OpenAPIV3 } from 'express-oas-generator';

import {
    TokenizationRequestRepository,
    FetchRequestsSpecification,
    TokenizationRequestAggregateRoot,
    TokenizationRequestFactory,
    TokenizationRequestDescription,
    AssetDescription,
} from '../model/tokenizationrequest.model';

import { components } from './components';

import {
    addTag,
    setControllerTag,
    getRequestBody,
    getDefaultResponses,
    addPathParameter,
    getDefaultResponsesNoContent
} from './doc';
import { requireDefined } from '../lib/assertions';
import { AuthenticationService } from "../services/authentication.service";

export function fillInSpec(spec: OpenAPIV3.Document): void {
    const tagName = 'Tokenization Requests';
    addTag(spec, {
        name: tagName,
        description: "Handling of Tokenization Requests"
    });
    setControllerTag(spec, /^\/api\/token-request.*/, tagName);

    TokenizationRequestController.createTokenRequest(spec);
    TokenizationRequestController.rejectTokenRequest(spec);
    TokenizationRequestController.acceptTokenRequest(spec);
    TokenizationRequestController.setAssetDescription(spec);
    TokenizationRequestController.fetchRequests(spec);
}

type CreateTokenRequestView = components["schemas"]["CreateTokenRequestView"];
type TokenRequestView = components["schemas"]["TokenRequestView"];
type AssetDescriptionView = components["schemas"]["AssetDescriptionView"];
type RejectTokenRequestView = components["schemas"]["RejectTokenRequestView"];
type SetAssetDescriptionView = components["schemas"]["SetAssetDescriptionView"];
type FetchRequestsSpecificationView = components["schemas"]["FetchRequestsSpecificationView"];
type FetchRequestsResponseView = components["schemas"]["FetchRequestsResponseView"];

@injectable()
@Controller('/token-request')
export class TokenizationRequestController extends ApiController {

    constructor(
        private tokenizationRequestRepository: TokenizationRequestRepository,
        private tokenizationRequestFactory: TokenizationRequestFactory,
        private authenticationService: AuthenticationService) {
        super();
    }

    static createTokenRequest(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/token-request"].post!;
        operationObject.summary = "Creates a new Tokenization Request";
        operationObject.description = "The authenticated user must be the tokenization requester";
        operationObject.requestBody = getRequestBody({
            description: "Tokenization Request creation data",
            view: "CreateTokenRequestView",
        });
        operationObject.responses = getDefaultResponses("TokenRequestView");
    }

    @HttpPost('')
    @Async()
    async createTokenRequest(createTokenRequestView: CreateTokenRequestView): Promise<TokenRequestView> {
        this.authenticationService.authenticatedUserIs(this.request, createTokenRequestView.requesterAddress);
        const description: TokenizationRequestDescription = {
            legalOfficerAddress: requireDefined(createTokenRequestView.legalOfficerAddress),
            requesterAddress: requireDefined(createTokenRequestView.requesterAddress),
            requestedTokenName: requireDefined(createTokenRequestView.requestedTokenName),
            bars: requireDefined(createTokenRequestView.bars),
            createdOn: moment().toISOString()
        };
        const id = uuid();
        let request = this.tokenizationRequestFactory.newPendingTokenizationRequest({id, description});
        await this.tokenizationRequestRepository.save(request);
        return this.toView(request);
    }

    private toView(request: TokenizationRequestAggregateRoot): TokenRequestView {
        var tokenDescription = request.getDescription();
        return {
            id: request.id,
            requestedTokenName: tokenDescription.requestedTokenName,
            legalOfficerAddress: tokenDescription.legalOfficerAddress,
            requesterAddress: tokenDescription.requesterAddress,
            bars: tokenDescription.bars,
            status: request.status,
            rejectReason: request.rejectReason === null ? undefined : request.rejectReason,
            createdOn: tokenDescription.createdOn,
            decisionOn: request.decisionOn === null ? undefined : request.decisionOn,
            assetDescription: this.toAssetDescriptionView(request.getAssetDescription())
        };
    }

    private toAssetDescriptionView(description: AssetDescription | undefined): AssetDescriptionView | undefined {
        if(description === undefined) {
            return undefined;
        } else {
            return {
                assetId: description.assetId,
                decimals: description.decimals,
            };
        }
    }

    static rejectTokenRequest(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/token-request/{requestId}/reject"].post!;
        operationObject.summary = "Rejects a Tokenization Request";
        operationObject.description = "The authenticated user must be the legal officer of the tokenization request";
        operationObject.requestBody = getRequestBody({
            description: "Tokenization Request rejection data",
            view: "RejectTokenRequestView",
        });
        operationObject.responses = getDefaultResponsesNoContent();
        addPathParameter(operationObject, 'requestId', "The ID of the request to reject");
    }

    @HttpPost('/:requestId/reject')
    @Async()
    async rejectTokenRequest(
            rejectTokenRequestView: RejectTokenRequestView,
            requestId: string) {

        const request = requireDefined(await this.tokenizationRequestRepository.findById(requestId));
        this.authenticationService.authenticatedUserIs(this.request, request.legalOfficerAddress)
            .requireLegalOfficer();
        request.reject(rejectTokenRequestView.rejectReason!, moment());
        await this.tokenizationRequestRepository.save(request);
    }

    static acceptTokenRequest(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/token-request/{requestId}/accept"].post!;
        operationObject.summary = "Accepts a Tokenization Request";
        operationObject.description = "The authenticated user must be the legal officer of the tokenization request";
        operationObject.requestBody = getRequestBody({
            description: "Tokenization Request acceptance data",
            view: "AcceptTokenRequestView",
        });
        operationObject.responses = getDefaultResponsesNoContent();
        addPathParameter(operationObject, 'requestId', "The ID of the request to accept");
    }

    @HttpPost('/:requestId/accept')
    @Async()
    async acceptTokenRequest(
        ignoredBody: any,
        requestId: string
    ) {
        const request = requireDefined(await this.tokenizationRequestRepository.findById(requestId));
        this.authenticationService.authenticatedUserIs(this.request, request.legalOfficerAddress)
            .requireLegalOfficer();
        request.accept(moment());
        await this.tokenizationRequestRepository.save(request);
    }

    static setAssetDescription(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/token-request/{requestId}/asset"].post!;
        operationObject.summary = "Sets the asset description of an accepted Tokenization Request";
        operationObject.description = "The session token to provide in the body is received upon Tokenization Request acceptance";
        operationObject.requestBody = getRequestBody({
            description: "The description of the asset created for the Tokenization Request",
            view: "SetAssetDescriptionView",
        });
        operationObject.responses = getDefaultResponsesNoContent();
        addPathParameter(operationObject, 'requestId', "The ID of the request");
    }

    @HttpPost('/:requestId/asset')
    @Async()
    async setAssetDescription(
            requestBody: SetAssetDescriptionView,
            requestId: string) {
        const description = {
            assetId: requireDefined(requestBody.description!.assetId),
            decimals: requireDefined(requestBody.description!.decimals),
        };
        const request = requireDefined(await this.tokenizationRequestRepository.findById(requestId));
        this.authenticationService.authenticatedUserIs(this.request, request.legalOfficerAddress)
            .requireLegalOfficer();
        request.setAssetDescription(description);
        await this.tokenizationRequestRepository.save(request);
    }

    static fetchRequests(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/token-request"].put!;
        operationObject.summary = "Lists Tokenization Requests based on a given specification";
        operationObject.description = "The authenticated user must be either the requester or the legal officers of the expected protection requests";
        operationObject.requestBody = getRequestBody({
            description: "The specification for fetching Tokenization Requests",
            view: "FetchRequestsSpecificationView",
        });
        operationObject.responses = getDefaultResponses("FetchRequestsResponseView");
    }

    @HttpPut('')
    @Async()
    async fetchRequests(specificationView: FetchRequestsSpecificationView): Promise<FetchRequestsResponseView> {
        this.authenticationService.authenticatedUserIsOneOf(this.request, specificationView.requesterAddress, specificationView.legalOfficerAddress)
        const specification: FetchRequestsSpecification = {
            expectedLegalOfficer: specificationView.legalOfficerAddress,
            expectedRequesterAddress: specificationView.requesterAddress,
            expectedStatus: requireDefined(specificationView.status),
        };
        const requests = await this.tokenizationRequestRepository.findBy(specification);
        return {
            requests: requests.map(request => this.toView(request))
        };
    }
}
