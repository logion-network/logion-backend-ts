import { setupApp } from "../../helpers/testapp";
import { AuthenticationController } from "../../../src/logion/controllers/authentication.controller";
import request from "supertest";
import { ALICE, BOB } from "../../../src/logion/model/addresses.model";
import { components } from "../../../src/logion/controllers/components";
import { Container } from "inversify";
import { Mock, It } from "moq.ts";
import { AuthenticationService } from "../../../src/logion/services/authentication.service";
import { Log } from "../../../src/logion/util/Log";

const { logger } = Log;
const TIMESTAMP = "2021-06-10T16:25:23.668294";
type AuthenticateRequestView = components["schemas"]["AuthenticateRequestView"];

const TOKEN_ALICE = "some-fake-token-for-ALICE";
const TOKEN_BOB = "some-fake-token-for-BOB";

describe("AuthenticationController", () => {

    it('should sign-in successfully', async () => {
        const app = setupApp(AuthenticationController, mockDependencies);
        await request(app)
            .post('/api/auth/sign-in')
            .send({
                addresses: [
                    ALICE,
                    BOB
                ]
            })
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.sessionId).toBeDefined();
                logger.info(JSON.stringify(response.body));
            });
    });

    it('should authenticate successfully', async () => {

        const authenticateRequest: AuthenticateRequestView = {
            signatures: {}
        };
        authenticateRequest.signatures![ALICE] = {
            signature: "signature-ALICE",
            signedOn: TIMESTAMP
        };
        authenticateRequest.signatures![BOB] = {
            signature: "signature-BOB",
            signedOn: TIMESTAMP
        };
        logger.info("REQUEST:" + JSON.stringify(authenticateRequest));
        const app = setupApp(AuthenticationController, mockDependencies);
        await request(app)
            .post('/api/auth/a4dade1d-f12c-414c-93f7-7f20ce1e2cb8/authenticate')
            .send(authenticateRequest)
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                logger.info("RESPONSE:" + JSON.stringify(response.body));
                expect(response.body.tokens).toBeDefined();
                expect(response.body.tokens[ALICE]).toBe(TOKEN_ALICE);
                expect(response.body.tokens[BOB]).toBe(TOKEN_BOB);
            });
    })
});

function mockDependencies(container: Container): void {
    const authenticationService = new Mock<AuthenticationService>();
    container.rebind(AuthenticationService).toConstantValue(authenticationService.object());

    authenticationService
        .setup(instance => instance.createToken(ALICE, It.IsAny<number>())).returns(TOKEN_ALICE)
        .setup(instance => instance.createToken(BOB, It.IsAny<number>())).returns(TOKEN_BOB);
}
