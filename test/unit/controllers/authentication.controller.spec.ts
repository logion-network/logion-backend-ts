import { setupApp } from "../../helpers/testapp";
import { AuthenticationController } from "../../../src/logion/controllers/authentication.controller";
import request from "supertest";
import { ALICE, BOB } from "../../../src/logion/model/addresses.model";
import { components } from "../../../src/logion/controllers/components";
import { Container } from "inversify";
import { Mock, It } from "moq.ts";
import { AuthenticationService } from "../../../src/logion/services/authentication.service";
import { Log } from "../../../src/logion/util/Log";
import {
    SessionRepository,
    SessionFactory,
    SessionAggregateRoot,
    NewSessionParameters
} from "../../../src/logion/model/session.model";
import moment from "moment";
import { SignatureService, VerifyParams } from "../../../src/logion/services/signature.service";

const TIMESTAMP = "2021-06-10T16:25:23.668294";
type AuthenticateRequestView = components["schemas"]["AuthenticateRequestView"];

const TOKEN_ALICE = "some-fake-token-for-ALICE";
const TOKEN_BOB = "some-fake-token-for-BOB";
const SESSION_ID = "a4dade1d-f12c-414c-93f7-7f20ce1e2cb8";

describe("AuthenticationController", () => {

    it('should sign-in successfully', async () => {
        const app = setupApp(AuthenticationController, mockDependenciesForSignIn);
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
        const app = setupApp(AuthenticationController, (container) => mockDependenciesForAuth(container,true, true));
        await request(app)
            .post(`/api/auth/${SESSION_ID}/authenticate`)
            .send(authenticateRequest)
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.tokens).toBeDefined();
                expect(response.body.tokens[ALICE].value).toBe(TOKEN_ALICE);
                expect(response.body.tokens[BOB].value).toBe(TOKEN_BOB);
            });
    })

    it('should fail to authenticate on wrong signature', async () => {

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
        const app = setupApp(AuthenticationController, (container) => mockDependenciesForAuth(container,false, true));
        await request(app)
            .post(`/api/auth/${SESSION_ID}/authenticate`)
            .send(authenticateRequest)
            .expect(401)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.error).toBe("Invalid signature");
            });
    })

    it('should fail to authenticate on missing session', async () => {

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
        const app = setupApp(AuthenticationController, (container) => mockDependenciesForAuth(container,true, false));
        await request(app)
            .post(`/api/auth/${SESSION_ID}/authenticate`)
            .send(authenticateRequest)
            .expect(401)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.error).toBe("Invalid session");
            });
    })
});

function mockDependenciesForSignIn(container: Container): void {
    const sessionRepository = new Mock<SessionRepository>();
    container.bind(SessionRepository).toConstantValue(sessionRepository.object());

    const sessionFactory = new Mock<SessionFactory>();
    container.bind(SessionFactory).toConstantValue(sessionFactory.object());

    const aliceSession = new Mock<SessionAggregateRoot>();
    aliceSession.setup(instance => instance.userAddress).returns(ALICE);

    sessionFactory.setup(instance => instance.newSession(It.Is<NewSessionParameters>(params => params.userAddress === ALICE)))
        .returns(aliceSession.object());

    const bobSession = new Mock<SessionAggregateRoot>();
    bobSession.setup(instance => instance.userAddress).returns(BOB);

    sessionFactory.setup(instance => instance.newSession(It.Is<NewSessionParameters>(params => params.userAddress === BOB)))
        .returns(bobSession.object());

    sessionRepository.setup(instance => instance.save)
        .returns(() => Promise.resolve());

    const signatureService = new Mock<SignatureService>();
    container.bind(SignatureService).toConstantValue(signatureService.object())
}

function mockDependenciesForAuth(container: Container, verifies:boolean, sessionExists:boolean): void {

    const sessionAlice = new Mock<SessionAggregateRoot>();

    const signatureService = new Mock<SignatureService>();
    signatureService.setup(instance => instance.verify(It.Is<VerifyParams>(params =>
        params.address === ALICE
        && params.signature === "signature-ALICE"
        && params.operation === "login"
        && params.resource === AuthenticationController.RESOURCE
        && params.attributes.length === 1
        && params.attributes[0] === SESSION_ID
    )))
        .returns(Promise.resolve(verifies));
    signatureService.setup(instance => instance.verify(It.Is<VerifyParams>(params =>
        params.address === BOB
        && params.signature === "signature-BOB"
        && params.operation === "login"
        && params.resource === AuthenticationController.RESOURCE
        && params.attributes.length === 1
        && params.attributes[0] === SESSION_ID
    )))
        .returns(Promise.resolve(verifies));
    container.bind(SignatureService).toConstantValue(signatureService.object());

    const authenticationService = new Mock<AuthenticationService>();
    container.rebind(AuthenticationService).toConstantValue(authenticationService.object());

    authenticationService
        .setup(instance => instance.createToken(ALICE, It.IsAny<number>())).returns({
        value: TOKEN_ALICE,
        expiredOn: moment()
    })
        .setup(instance => instance.createToken(BOB, It.IsAny<number>())).returns({
        value: TOKEN_BOB,
        expiredOn: moment()
    });

    const sessionRepository = new Mock<SessionRepository>();
    if (sessionExists) {
        sessionRepository.setup(instance => instance.find(ALICE, SESSION_ID))
            .returns(Promise.resolve(sessionAlice.object()))
        sessionRepository.setup(instance => instance.find(BOB, SESSION_ID))
            .returns(Promise.resolve(sessionAlice.object()))
    } else {
        sessionRepository.setup(instance => instance.find(ALICE, SESSION_ID))
            .returns(Promise.resolve(undefined))
        sessionRepository.setup(instance => instance.find(BOB, SESSION_ID))
            .returns(Promise.resolve(undefined))
    }
    container.bind(SessionRepository).toConstantValue(sessionRepository.object());
    sessionRepository.setup(instance => instance.delete)
        .returns(() => Promise.resolve())

    const sessionFactory = new Mock<SessionFactory>();
    container.bind(SessionFactory).toConstantValue(sessionFactory.object());
}
