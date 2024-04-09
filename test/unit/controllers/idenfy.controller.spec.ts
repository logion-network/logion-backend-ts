import { AuthenticationService, TestApp } from "@logion/rest-api-core";
import { ALICE, AuthenticationServiceMock, BOB, mockAuthenticationWithCondition } from "@logion/rest-api-core/dist/TestApp.js";
import bodyParser from "body-parser";
import { Container } from "inversify";
import request from "supertest";
import { It, Mock } from "moq.ts";
import { IdenfyController } from "../../../src/logion/controllers/idenfy.controller.js";
import { LocRequestAggregateRoot, LocRequestRepository } from "../../../src/logion/model/locrequest.model.js";
import { IdenfyService, IdenfyVerificationCreation } from "../../../src/logion/services/idenfy/idenfy.service.js";
import { mockRequester } from "./locrequest.controller.shared.js";
import { ValidAccountId } from "@logion/node-api";
import express, { Express } from 'express';
import { Dino } from 'dinoloop';
import { ApplicationErrorController } from "@logion/rest-api-core/dist/ApplicationErrorController.js";
import { JsonResponse } from "@logion/rest-api-core/dist/JsonResponse.js";

const { setupApp } = TestApp;

describe("IdenfyController", () => {

    it("creates verification session for LOC requester", async () => {
        const app = setupApp(IdenfyController, container => mockVerification(container, ALICE));

        await request(app)
            .post(`/api/idenfy/verification-session/${ REQUEST_ID }`)
            .send({ ...VERIFICATION_CREATION })
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
        const app = setupIDenfyCallbackApp();

        await request(app)
            .post(`/api/idenfy/callback`)
            .set("idenfy-signature", "signature")
            .send({ final: true })
            .expect(200);

        service.verify(service => service.callback(It.IsAny(), It.IsAny(), It.IsAny()));
    });
});

function mockVerification(container: Container, requester: string) {
    const locRequest = new Mock<LocRequestAggregateRoot>();
    mockRequester(locRequest, ValidAccountId.polkadot(requester));

    const repository = new Mock<LocRequestRepository>();
    repository.setup(instance => instance.findById(REQUEST_ID)).returnsAsync(locRequest.object());
    container.bind(LocRequestRepository).toConstantValue(repository.object());

    service = new Mock<IdenfyService>();
    service.setup(instance => instance.createVerificationSession(
        locRequest.object(),
        It.Is<IdenfyVerificationCreation>(params =>
            params.successUrl === VERIFICATION_CREATION.successUrl &&
            params.errorUrl === VERIFICATION_CREATION.errorUrl &&
            params.unverifiedUrl === VERIFICATION_CREATION.unverifiedUrl
        )
    )).returnsAsync({ url: REDIRECT_URL })
    container.bind(IdenfyService).toConstantValue(service.object());
}

const REQUEST_ID = "d47d151e-3174-4ab0-846c-088d104ddc1a";
const REDIRECT_URL = "https://ivs.idenfy.com/api/v2/redirect?authToken=tSfnDiNBT16iP7ThpP6K8QfF2maTK0Vvkxfvq4YV";
const VERIFICATION_CREATION: IdenfyVerificationCreation = {
    successUrl: `https://logion.network/user/idenfy?result=success&locId=${ REQUEST_ID }`,
    errorUrl: `https://logion.network/user/idenfy?result=error&locId=${ REQUEST_ID }`,
    unverifiedUrl: `https://logion.network/user/idenfy?result=unverfied&locId=${ REQUEST_ID }`,
}
let service: Mock<IdenfyService>;

function setupIDenfyCallbackApp(): Express {
    const app = express();
    app.use(bodyParser.json({
        verify: (req, _res, buf) => {
            (req as any).rawBody = buf;
        }
    }));
    app.use(bodyParser.urlencoded({ extended: false }));

    const dino = new Dino(app, '/api');
    dino.useRouter(() => express.Router());
    dino.registerController(IdenfyController);
    dino.registerApplicationError(ApplicationErrorController);
    dino.requestEnd(JsonResponse);

    const container = new Container({ defaultScope: "Singleton" });

    mockCallback(container);
    const authenticationService = new Mock<AuthenticationService>();
    container.bind(AuthenticationService).toConstantValue(authenticationService.object());

    dino.dependencyResolver<Container>(container,
        (injector, type) => {
            return injector.resolve(type);
        });

    dino.bind();

    return app;
}

function mockCallback(container: Container) {

    const repository = new Mock<LocRequestRepository>();
    container.bind(LocRequestRepository).toConstantValue(repository.object());

    service = new Mock<IdenfyService>();
    service.setup(instance => instance.callback(It.IsAny(), It.IsAny(), It.IsAny())).returnsAsync();
    container.bind(IdenfyService).toConstantValue(service.object());
}
