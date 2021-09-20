import { injectable } from 'inversify';
import { ApiController, Controller, HttpPost, HttpPut, Async, BadRequestException } from 'dinoloop';
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
import { sha256 } from '../lib/crypto/hashing';
import { SignatureService } from '../services/signature.service';
import { randomAlphanumericString } from '../lib/random';
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
type AcceptTokenRequestView = components["schemas"]["AcceptTokenRequestView"];
type TokenRequestAcceptedView = components["schemas"]["TokenRequestAcceptedView"];
type SetAssetDescriptionView = components["schemas"]["SetAssetDescriptionView"];
type FetchRequestsSpecificationView = components["schemas"]["FetchRequestsSpecificationView"];
type FetchRequestsResponseView = components["schemas"]["FetchRequestsResponseView"];

@injectable()
@Controller('/token-request')
export class TokenizationRequestController extends ApiController {

    static readonly RESOURCE = "token-request";

    constructor(
        private tokenizationRequestRepository: TokenizationRequestRepository,
        private tokenizationRequestFactory: TokenizationRequestFactory,
        private signatureService: SignatureService,
        private authenticationService: AuthenticationService) {
        super();
    }

    static createTokenRequest(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/token-request"].post!;
        operationObject.summary = "Creates a new Tokenization Request";
        operationObject.description = "<p>The signature's resource is <code>token-request</code>, the operation <code>create</code> and the additional fields are:</p><ul><li><code>legalOfficerAddress</code></li><li><code>requestedTokenName</code></li><li><code>bars</code></li></ul><p>";
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

        if(!await this.signatureService.verify({
            signature: requireDefined(createTokenRequestView.signature),
            address: requireDefined(createTokenRequestView.requesterAddress),
            resource: TokenizationRequestController.RESOURCE,
            operation: "create",
            timestamp: requireDefined(createTokenRequestView.signedOn),
            attributes: [
                createTokenRequestView.legalOfficerAddress,
                createTokenRequestView.requestedTokenName,
                createTokenRequestView.bars
            ]
        })) {
            throw new BadRequestException();
        } else {
            const id = uuid();
            var request = this.tokenizationRequestFactory.newPendingTokenizationRequest({id, description});
            await this.tokenizationRequestRepository.save(request);
            return this.toView(request);
        }
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
        operationObject.description = "<p>The signature's resource is <code>token-request</code>, the operation <code>reject</code> and the additional fields are:</p><ul><li><code>requestId</code></li><li><code>rejectReason</code></li></ul><p>";
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

        if(! await this.signatureService.verify({
            signature: requireDefined(rejectTokenRequestView.signature),
            address: request.getDescription().legalOfficerAddress,
            resource: TokenizationRequestController.RESOURCE,
            operation: "reject",
            timestamp: requireDefined(rejectTokenRequestView.signedOn),
            attributes: [
                requestId,
                requireDefined(rejectTokenRequestView.rejectReason)
            ]
        })) {
            throw new BadRequestException();
        } else {
            request.reject(rejectTokenRequestView.rejectReason!, moment());
            await this.tokenizationRequestRepository.save(request);
        }
    }

    static acceptTokenRequest(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/token-request/{requestId}/accept"].post!;
        operationObject.summary = "Accepts a Tokenization Request";
        operationObject.description = "<p>The signature's resource is <code>token-request</code>, the operation <code>accept</code> and the additional field is the <code>requestId</code>.<p>";
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
        acceptTokenRequestView: AcceptTokenRequestView,
        requestId: string
    ): Promise<TokenRequestAcceptedView> {
        const request = requireDefined(await this.tokenizationRequestRepository.findById(requestId));
        this.authenticationService.authenticatedUserIs(this.request, request.legalOfficerAddress)
            .requireLegalOfficer();

        if(!await this.signatureService.verify({
            signature: requireDefined(acceptTokenRequestView.signature),
            address: request.getDescription().legalOfficerAddress,
            resource: TokenizationRequestController.RESOURCE,
            operation: "accept",
            timestamp: requireDefined(acceptTokenRequestView.signedOn),
            attributes: [
                requestId
            ]
        })) {
            throw new BadRequestException();
        } else {
            const sessionToken = randomAlphanumericString(32);
            request.accept(moment(), sha256([ sessionToken ]));
            await this.tokenizationRequestRepository.save(request);
            return { sessionToken };
        }
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
        const sessionToken = requireDefined(requestBody.sessionToken);
        const description = {
            assetId: requireDefined(requestBody.description!.assetId),
            decimals: requireDefined(requestBody.description!.decimals),
        };
        const request = requireDefined(await this.tokenizationRequestRepository.findById(requestId));
        this.authenticationService.authenticatedUserIs(this.request, request.legalOfficerAddress)
            .requireLegalOfficer();
        request.setAssetDescription(sha256([sessionToken]), description);
        await this.tokenizationRequestRepository.save(request);
    }

    static fetchRequests(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/token-request"].put!;
        operationObject.summary = "Lists Tokenization Requests based on a given specification";
        operationObject.description = "No authentication required yet";
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
