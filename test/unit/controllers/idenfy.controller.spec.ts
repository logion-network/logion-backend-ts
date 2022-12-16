import { TestApp } from "@logion/rest-api-core";
import { ALICE, BOB } from "@logion/rest-api-core/dist/TestApp.js";
import { Container } from "inversify";
import request from "supertest";
import { It, Mock, Times } from "moq.ts";
import { IdenfyController } from "../../../src/logion/controllers/idenfy.controller.js";
import { LocRequestAggregateRoot, LocRequestRepository } from "../../../src/logion/model/locrequest.model.js";
import { IdenfyService } from "../../../src/logion/services/idenfy/idenfy.service.js";

const { setupApp } = TestApp;

describe("IdenfyController", () => {

    it("creates verification session for LOC requester", async () => {
        const app = setupApp(IdenfyController, container => mockVerification(container, ALICE));

        await request(app)
            .post(`/api/idenfy/verification-session/${ REQUEST_ID }`)
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.url).toBe(REDIRECT_URL);
            });
    });

    it("fails at creating verification session for others", async () => {
        const app = setupApp(IdenfyController, container => mockVerification(container, BOB));

        await request(app)
            .post(`/api/idenfy/verification-session/${ REQUEST_ID }`)
            .expect(401);
    });

    it("provides iDenfy callback", async () => {
        const app = setupApp(IdenfyController, mockCallback);

        await request(app)
            .post(`/api/idenfy/callback/${ SHARED_SECRET }`)
            .expect(200);

        service.verify(service => service.callback(It.IsAny(), It.IsAny()));
    });

    it("detects bad secret on callback", async () => {
        const app = setupApp(IdenfyController, mockCallback);

        await request(app)
            .post(`/api/idenfy/callback/another-secret`)
            .expect(403);

        service.verify(service => service.callback(It.IsAny(), It.IsAny()), Times.Never());
    });
});

function mockVerification(container: Container, requester: string) {
    const locRequest = new Mock<LocRequestAggregateRoot>();
    locRequest.setup(instance => instance.requesterAddress).returns(requester);

    const repository = new Mock<LocRequestRepository>();
    repository.setup(instance => instance.findById(REQUEST_ID)).returnsAsync(locRequest.object());
    container.bind(LocRequestRepository).toConstantValue(repository.object());

    service = new Mock<IdenfyService>();
    service.setup(instance => instance.createVerificationSession(locRequest.object())).returnsAsync({ url: REDIRECT_URL })
    container.bind(IdenfyService).toConstantValue(service.object());
}

const REQUEST_ID = "d47d151e-3174-4ab0-846c-088d104ddc1a";
const REDIRECT_URL = "https://ivs.idenfy.com/api/v2/redirect?authToken=tSfnDiNBT16iP7ThpP6K8QfF2maTK0Vvkxfvq4YV";
let service: Mock<IdenfyService>;

function mockCallback(container: Container) {
    process.env.IDENFY_SECRET = SHARED_SECRET;

    const repository = new Mock<LocRequestRepository>();
    container.bind(LocRequestRepository).toConstantValue(repository.object());

    service = new Mock<IdenfyService>();
    service.setup(instance => instance.callback(It.IsAny(), It.IsAny())).returnsAsync();
    container.bind(IdenfyService).toConstantValue(service.object());
}

const SHARED_SECRET = "some-secret";
