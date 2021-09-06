import { setupApp } from "../../helpers/testapp";
import { AuthenticationController } from "../../../src/logion/controllers/authentication.controller";
import request from "supertest";
import { ALICE, BOB } from "../../../src/logion/model/addresses.model";
import { components } from "../../../src/logion/controllers/components";
import { createLogger, format } from "winston";

const logger = createLogger({format: format.simple()});
const TIMESTAMP = "2021-06-10T16:25:23.668294";
type AuthenticateRequestView = components["schemas"]["AuthenticateRequestView"];

describe("AuthenticationController", () => {

    it('should sign-in successfully', async () => {
        const app = setupApp(AuthenticationController, () => {
        });
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
        const app = setupApp(AuthenticationController, () => {
        });
        await request(app)
            .post('/api/auth/a4dade1d-f12c-414c-93f7-7f20ce1e2cb8/authenticate')
            .send(authenticateRequest)
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                logger.info("RESPONSE:" + JSON.stringify(response.body));
                expect(response.body.tokens).toBeDefined();
                expect(response.body.tokens[ALICE]).toBe("some-fake-token-for-" + ALICE);
                expect(response.body.tokens[BOB]).toBe("some-fake-token-for-" + BOB);
            });
    })
});
