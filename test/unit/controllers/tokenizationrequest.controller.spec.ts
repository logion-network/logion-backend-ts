import { Container } from 'inversify';
import { Mock, It } from 'moq.ts';
import { setupApp } from '../../helpers/testapp';
import request from 'supertest';
import moment from 'moment';

import {
    TokenizationRequestRepository,
    TokenizationRequestFactory,
    TokenizationRequestAggregateRoot,
    NewTokenizationRequestParameters,
    FetchRequestsSpecification,
} from '../../../src/logion/model/tokenizationrequest.model';
import { ALICE } from '../../../src/logion/model/addresses.model';
import { TokenizationRequestController } from '../../../src/logion/controllers/tokenizationrequest.controller';
import { components } from '../../../src/logion/controllers/components';
import { SignatureService, VerifyParams } from '../../../src/logion/services/signature.service';

describe('TokenizationRequestController', () => {

    it('createTokenRequest success with valid tokenization request', async () => {
        const app = setupApp(TokenizationRequestController, mockModelForRequest);

        await request(app)
            .post('/api/token-request')
            .send({
                requestedTokenName: TOKEN_NAME,
                legalOfficerAddress: ALICE,
                requesterAddress: REQUESTER_ADDRESS,
                bars: 1,
                signature: "signature",
                signedOn: moment().toISOString(),
            })
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.id).toBeDefined();
            });
    });

    it('createTokenRequest failure with empty request', async () => {
        const app = setupApp(TokenizationRequestController, mockModelForRequest);

        await request(app)
            .post('/api/token-request')
            .send({})
            .expect(500)
            .expect('Content-Type', /application\/json/);
    });

    it('rejectWithWrongSignature', async () => {
        const app = setupApp(TokenizationRequestController, container => mockModelForReject(container, false));

        await request(app)
            .post('/api/token-request/' + REQUEST_ID + "/reject")
            .send({
                signature: SIGNATURE,
                rejectReason: REJECT_REASON,
                signedOn: moment().toISOString()
            })
            .expect(400)
            .expect('Content-Type', /application\/json/);
    });

    it('rejectWithValidSignature', async () => {
        const app = setupApp(TokenizationRequestController, container => mockModelForReject(container, true));

        await request(app)
            .post('/api/token-request/' + REQUEST_ID + "/reject")
            .send({
                signature: SIGNATURE,
                rejectReason: REJECT_REASON,
                signedOn: moment().toISOString()
            })
            .expect(200)
            .expect('Content-Type', /application\/json/);
    });

    it('acceptWithWrongSignature', async () => {
        const app = setupApp(TokenizationRequestController, container => mockModelForAccept(container, false));

        await request(app)
            .post('/api/token-request/' + REQUEST_ID + "/accept")
            .send({
                signature: SIGNATURE,
                signedOn: moment().toISOString()
            })
            .expect(400)
            .expect('Content-Type', /application\/json/);
    });

    it('acceptWithValidSignature', async () => {
        const app = setupApp(TokenizationRequestController, container => mockModelForAccept(container, true));

        await request(app)
            .post('/api/token-request/' + REQUEST_ID + "/accept")
            .send({
                signature: SIGNATURE,
                signedOn: moment().toISOString()
            })
            .expect(200)
            .expect('Content-Type', /application\/json/);
    });

    it('fetchProtectionRequests returns expected response', async () => {
        const requestBody: FetchRequestsSpecificationView = {
            legalOfficerAddress: ALICE,
            status: 'PENDING'
        };
        const specification: FetchRequestsSpecification = {
            expectedLegalOfficer: ALICE,
            expectedStatus: 'PENDING',
        };

        const app = setupApp(TokenizationRequestController, container => mockModelForFetch(container, specification));

        await request(app)
            .put('/api/token-request')
            .send(requestBody)
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.requests).toBeDefined();
                expect(response.body.requests.length).toBe(1);
            });
    });
});

const TOKEN_NAME = "MYT";
const REQUESTER_ADDRESS = "5H4MvAsobfZ6bBCDyj5dsrWYLrA8HrRzaqa9p61UXtxMhSCY";

function mockModelForRequest(container: Container): void {
    const repository = new Mock<TokenizationRequestRepository>();
    repository.setup(instance => instance.save)
        .returns(() => Promise.resolve());
    container.bind(TokenizationRequestRepository).toConstantValue(repository.object());

    const factory = new Mock<TokenizationRequestFactory>();
    const root = new Mock<TokenizationRequestAggregateRoot>();
    root.setup(instance => instance.id)
        .returns("id");
    root.setup(instance => instance.getDescription())
        .returns({
            requestedTokenName: TOKEN_NAME,
            legalOfficerAddress: ALICE,
            requesterAddress: REQUESTER_ADDRESS,
            bars: 1,
            createdOn: moment().toISOString()
        });
    root.setup(instance => instance.getAssetDescription()).returns(undefined);
    factory.setup(instance => instance.newPendingTokenizationRequest(
            It.Is<NewTokenizationRequestParameters>(params =>
                params.description.requesterAddress === REQUESTER_ADDRESS
                && params.description.legalOfficerAddress === ALICE
                && params.description.bars === 1
                && params.description.requestedTokenName === TOKEN_NAME)))
        .returns(root.object());
    container.bind(TokenizationRequestFactory).toConstantValue(factory.object());

    const signatureService = new Mock<SignatureService>();
    signatureService.setup(instance => instance.verify(It.Is<VerifyParams>(params =>
        params.address === REQUESTER_ADDRESS
        && params.signature === SIGNATURE
        && params.operation === "create"
        && params.resource === TokenizationRequestController.RESOURCE
        && params.attributes.length === 3
        && params.attributes[0] === ALICE
        && params.attributes[1] === TOKEN_NAME
        && params.attributes[2] === 1
    )))
        .returns(Promise.resolve(true));
    container.bind(SignatureService).toConstantValue(signatureService.object());
}

type FetchRequestsSpecificationView = components["schemas"]["FetchRequestsSpecificationView"];

const TIMESTAMP = "2021-06-10T16:25:23.668294";

function mockModelForFetch(container: Container, specification: FetchRequestsSpecification): void {
    const repository = new Mock<TokenizationRequestRepository>();

    const tokenizationRequest = new Mock<TokenizationRequestAggregateRoot>();
    tokenizationRequest.setup(instance => instance.requesterAddress).returns(REQUESTER_ADDRESS);
    tokenizationRequest.setup(instance => instance.createdOn).returns(TIMESTAMP);
    tokenizationRequest.setup(instance => instance.status).returns('PENDING');
    tokenizationRequest.setup(instance => instance.getDescription())
        .returns({
            requestedTokenName: TOKEN_NAME,
            legalOfficerAddress: ALICE,
            requesterAddress: REQUESTER_ADDRESS,
            bars: 1,
            createdOn: moment().toISOString()
        });
    tokenizationRequest.setup(instance => instance.getAssetDescription()).returns(undefined);

    const requests: TokenizationRequestAggregateRoot[] = [ tokenizationRequest.object() ];
    repository.setup(instance => instance.findBy(It.Is<FetchRequestsSpecification>(params =>
                params.expectedRequesterAddress === specification.expectedRequesterAddress
                && params.expectedLegalOfficer === specification.expectedLegalOfficer
                && params.expectedStatus === specification.expectedStatus
                && params.expectedTokenName === specification.expectedTokenName)))
        .returns(Promise.resolve(requests));
    container.bind(TokenizationRequestRepository).toConstantValue(repository.object());

    const factory = new Mock<TokenizationRequestFactory>();
    container.bind(TokenizationRequestFactory).toConstantValue(factory.object());

    const signatureService = new Mock<SignatureService>();
    container.bind(SignatureService).toConstantValue(signatureService.object());
}

function mockModelForReject(container: Container, verifies: boolean): void {
    const root = new Mock<TokenizationRequestAggregateRoot>();
    root.setup(instance => instance.getDescription())
        .returns({
            requestedTokenName: TOKEN_NAME,
            legalOfficerAddress: ALICE,
            requesterAddress: REQUESTER_ADDRESS,
            bars: 1,
            createdOn: moment().toISOString()
        });
    root.setup(instance => instance.reject)
        .returns(() => {});

    const repository = new Mock<TokenizationRequestRepository>();
    repository.setup(instance => instance.findById(REQUEST_ID))
        .returns(Promise.resolve(root.object()));
    repository.setup(instance => instance.save)
        .returns(() => Promise.resolve());
    container.bind(TokenizationRequestRepository).toConstantValue(repository.object());

    const factory = new Mock<TokenizationRequestFactory>();
    container.bind(TokenizationRequestFactory).toConstantValue(factory.object());

    const signatureService = new Mock<SignatureService>();
    signatureService.setup(instance => instance.verify(It.Is<VerifyParams>(params =>
        params.address === ALICE
        && params.signature === SIGNATURE
        && params.operation === "reject"
        && params.resource === TokenizationRequestController.RESOURCE
        && params.attributes.length === 2
        && params.attributes[0] === REQUEST_ID
        && params.attributes[1] === REJECT_REASON
    )))
        .returns(Promise.resolve(verifies));
    container.bind(SignatureService).toConstantValue(signatureService.object());
}

const REQUEST_ID = "requestId";

const SIGNATURE = "signature";

const REJECT_REASON = "reason";

function mockModelForAccept(container: Container, verifies: boolean): void {
    const root = new Mock<TokenizationRequestAggregateRoot>();
    root.setup(instance => instance.getDescription())
        .returns({
            requestedTokenName: TOKEN_NAME,
            legalOfficerAddress: ALICE,
            requesterAddress: REQUESTER_ADDRESS,
            bars: 1,
            createdOn: moment().toISOString()
        });
    root.setup(instance => instance.accept)
        .returns(() => {});

    const repository = new Mock<TokenizationRequestRepository>();
    repository.setup(instance => instance.findById(REQUEST_ID))
        .returns(Promise.resolve(root.object()));
    repository.setup(instance => instance.save)
        .returns(() => Promise.resolve());
    container.bind(TokenizationRequestRepository).toConstantValue(repository.object());

    const factory = new Mock<TokenizationRequestFactory>();
    container.bind(TokenizationRequestFactory).toConstantValue(factory.object());

    const signatureService = new Mock<SignatureService>();
    signatureService.setup(instance => instance.verify(It.Is<VerifyParams>(params =>
        params.address === ALICE
        && params.signature === SIGNATURE
        && params.operation === "accept"
        && params.resource === TokenizationRequestController.RESOURCE
        && params.attributes.length === 1
        && params.attributes[0] === REQUEST_ID
    )))
        .returns(Promise.resolve(verifies));
    container.bind(SignatureService).toConstantValue(signatureService.object());
}
