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
    NewLocRequestParameters
} from "../../../src/logion/model/locrequest.model";
import moment from "moment";

const testData = {
    requesterAddress: "5CXLTF2PFBE89tTYsrofGPkSfGTdmW4ciw4vAfgcKhjggRgZ",
    ownerAddress: ALICE,
    description: "I want to open a case"
};

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
                expect(response.body.requests[0].id).toBeDefined()
                expect(response.body.requests[0].requesterAddress).toBe(testData.requesterAddress)
                expect(response.body.requests[0].ownerAddress).toBe(testData.ownerAddress)
                expect(response.body.requests[0].status).toBe("OPEN")
                expect(response.body.requests[0].rejectReason).toBe("Not valid")
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
})

function mockModelForCreation(container: Container): void {

    const repository = new Mock<LocRequestRepository>();
    repository.setup(instance => instance.save)
        .returns(() => Promise.resolve());
    container.bind(LocRequestRepository).toConstantValue(repository.object());

    const factory = new Mock<LocRequestFactory>();
    const root = new Mock<LocRequestAggregateRoot>();
    root.setup(instance => instance.id)
        .returns("id");
    root.setup(instance => instance.status)
        .returns("REQUESTED");
    root.setup(instance => instance.getDescription())
        .returns({
            ...testData,
            createdOn: moment().toISOString()
        })
    factory.setup(instance => instance.newLocRequest(It.Is<NewLocRequestParameters>(params =>
        params.description.requesterAddress == testData.requesterAddress &&
        params.description.ownerAddress == testData.ownerAddress &&
        params.description.description == testData.description
    )))
        .returns(root.object())
    container.bind(LocRequestFactory).toConstantValue(factory.object());

}

function mockModelForFetch(container: Container): void {

    const request = new Mock<LocRequestAggregateRoot>();
    request.setup(instance => instance.id)
        .returns("id");
    request.setup(instance => instance.status)
        .returns("OPEN");
    request.setup(instance => instance.rejectReason)
        .returns("Not valid");
    request.setup(instance => instance.getDescription())
        .returns({
            ...testData,
            createdOn: moment().toISOString()
        })
    const requests: LocRequestAggregateRoot[] = [ request.object() ]

    const repository = new Mock<LocRequestRepository>();
    repository.setup(instance => instance.findBy)
        .returns(() => Promise.resolve(requests));
    container.bind(LocRequestRepository).toConstantValue(repository.object());

    const factory = new Mock<LocRequestFactory>();
    container.bind(LocRequestFactory).toConstantValue(factory.object());

}
