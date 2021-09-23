import { setupApp } from "../../helpers/testapp";
import { LocRequestController } from "../../../src/logion/controllers/locrequest.controller";
import { Container } from "inversify";
import request from "supertest";
import { ALICE } from "../../../src/logion/model/addresses.model";
import { Mock, It } from "moq.ts";
import {
    LocRequestRepository,
    LocRequestFactory,
    LocRequestAggregateRoot,
    NewLocRequestParameters,
    LocRequestStatus
} from "../../../src/logion/model/locrequest.model";
import moment, { Moment } from "moment";
import { ProtectionRequestRepository } from "../../../src/logion/model/protectionrequest.model";

const testData = {
    requesterAddress: "5CXLTF2PFBE89tTYsrofGPkSfGTdmW4ciw4vAfgcKhjggRgZ",
    ownerAddress: ALICE,
    description: "I want to open a case",
    userIdentity: {
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@logion.network",
        phoneNumber: "+1234"
    }
};
const REJECT_REASON = "Illegal";
const REQUEST_ID = "3e67427a-d80f-41d7-9c86-75a63b8563a1"

describe('LocRequestController', () => {

    it('succeeds to create loc request', async () => {
        const app = setupApp(LocRequestController, mockModelForCreation)
        await request(app)
            .post('/api/loc-request')
            .send(testData)
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.id).toBeDefined();
                expect(response.body.status).toBe("REQUESTED");
                expect(response.body.userIdentity.lastName).toBe("Doe");
            });
    });

    it('succeeds to fetch loc requests', async () => {
        const app = setupApp(LocRequestController, mockModelForFetch)
        await request(app)
            .put('/api/loc-request')
            .send({
                requesterAddress: testData.requesterAddress,
                statuses: [ "OPEN", "REJECTED" ]
            })
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.requests.length).toBe(1);
                expect(response.body.requests[0].id).toBe(REQUEST_ID)
                expect(response.body.requests[0].requesterAddress).toBe(testData.requesterAddress)
                expect(response.body.requests[0].ownerAddress).toBe(testData.ownerAddress)
                expect(response.body.requests[0].status).toBe("REJECTED")
                expect(response.body.requests[0].rejectReason).toBe(REJECT_REASON)
                expect(response.body.requests[0].userIdentity.lastName).toBe("Doe");
            });
    });

    it('fails to create loc request - authentication failure', async () => {
        const app = setupApp(LocRequestController, mockModelForCreation, false)
        await request(app)
            .post('/api/loc-request')
            .send(testData)
            .expect(401)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.id).toBeUndefined();
            });
    });

    it('fails to fetch loc requests - authentication failure', async () => {
        const app = setupApp(LocRequestController, mockModelForFetch, false)
        await request(app)
            .put('/api/loc-request')
            .send({
                requesterAddress: testData.requesterAddress,
                statuses: [ "OPEN", "REJECTED" ]
            })
            .expect(401)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.requests).toBeUndefined();
            });
    });

    it('rejects a requested loc', async () => {
        const app = setupApp(LocRequestController, mockModelForReject)
        await request(app)
            .post(`/api/loc-request/${ REQUEST_ID }/reject`)
            .send({
                rejectReason: REJECT_REASON
            })
            .expect(200)
    })

    it('accepts a requested loc', async () => {
        const app = setupApp(LocRequestController, mockModelForAccept)
        await request(app)
            .post(`/api/loc-request/${ REQUEST_ID }/accept`)
            // .send({})
            .expect(200)
    })
})

function mockModelForReject(container: Container): void {
    const factory = new Mock<LocRequestFactory>();
    container.bind(LocRequestFactory).toConstantValue(factory.object());
    const request = mockRequest("REQUESTED");
    request.setup(instance => instance.reject(It.Is<string>(reason => reason === REJECT_REASON), It.IsAny<Moment>()))
        .returns();
    const repository = new Mock<LocRequestRepository>();
    repository.setup(instance => instance.save(It.IsAny<LocRequestAggregateRoot>()))
        .returns(Promise.resolve());
    repository.setup(instance => instance.findById(It.Is<string>(id => id === REQUEST_ID)))
        .returns(Promise.resolve(request.object()));
    container.bind(LocRequestRepository).toConstantValue(repository.object());
    const protectionRepository = new Mock<ProtectionRequestRepository>();
    container.bind(ProtectionRequestRepository).toConstantValue(protectionRepository.object());
}

function mockModelForAccept(container: Container): void {
    const factory = new Mock<LocRequestFactory>();
    container.bind(LocRequestFactory).toConstantValue(factory.object());
    const request = mockRequest("REQUESTED");
    request.setup(instance => instance.accept(It.Is<string>(It.IsAny<Moment>())))
        .returns();
    const repository = new Mock<LocRequestRepository>();
    repository.setup(instance => instance.save(It.IsAny<LocRequestAggregateRoot>()))
        .returns(Promise.resolve());
    repository.setup(instance => instance.findById(It.Is<string>(id => id === REQUEST_ID)))
        .returns(Promise.resolve(request.object()));
    container.bind(LocRequestRepository).toConstantValue(repository.object());
    const protectionRepository = new Mock<ProtectionRequestRepository>();
    container.bind(ProtectionRequestRepository).toConstantValue(protectionRepository.object());
}

function mockModelForCreation(container: Container): void {

    const repository = new Mock<LocRequestRepository>();
    repository.setup(instance => instance.save)
        .returns(() => Promise.resolve());
    container.bind(LocRequestRepository).toConstantValue(repository.object());

    const factory = new Mock<LocRequestFactory>();
    const request = mockRequest("REQUESTED")
    factory.setup(instance => instance.newLocRequest(It.Is<NewLocRequestParameters>(params =>
        params.description.requesterAddress == testData.requesterAddress &&
        params.description.ownerAddress == testData.ownerAddress &&
        params.description.description == testData.description
    )))
        .returns(request.object())
    container.bind(LocRequestFactory).toConstantValue(factory.object());
    const protectionRepository = new Mock<ProtectionRequestRepository>();
    container.bind(ProtectionRequestRepository).toConstantValue(protectionRepository.object());
    protectionRepository.setup(instance => instance.findBy(It.IsAny())).returns(Promise.resolve([]))
}

function mockRequest(status: LocRequestStatus): Mock<LocRequestAggregateRoot> {
    const request = new Mock<LocRequestAggregateRoot>();
    request.setup(instance => instance.status)
        .returns(status);
    request.setup(instance => instance.id)
        .returns(REQUEST_ID);
    request.setup(instance => instance.getDescription())
        .returns({
            ...testData,
            createdOn: moment().toISOString()
        })
    return request;
}

function mockModelForFetch(container: Container): void {
    const request = mockRequest("REJECTED")
    request.setup(instance => instance.rejectReason)
        .returns(REJECT_REASON);
    const requests: LocRequestAggregateRoot[] = [ request.object() ]

    const repository = new Mock<LocRequestRepository>();
    repository.setup(instance => instance.findBy)
        .returns(() => Promise.resolve(requests));
    container.bind(LocRequestRepository).toConstantValue(repository.object());

    const factory = new Mock<LocRequestFactory>();
    container.bind(LocRequestFactory).toConstantValue(factory.object());

    const protectionRepository = new Mock<ProtectionRequestRepository>();
    container.bind(ProtectionRequestRepository).toConstantValue(protectionRepository.object());
    protectionRepository.setup(instance => instance.findBy(It.IsAny())).returns(Promise.resolve([]))
}
