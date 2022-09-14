import { DateTime } from "luxon";
import { setupApp } from "../../helpers/testapp";
import { AuthenticationController } from "../../../src/logion/controllers/authentication.controller";
import request from "supertest";
import { ALICE, BOB } from "../../helpers/addresses";
import { components } from "../../../src/logion/controllers/components";
import { Container } from "inversify";
import { Mock, It } from "moq.ts";
import { AuthenticationService } from "../../../src/logion/services/authentication.service";
import {
    SessionRepository,
    SessionFactory,
    SessionAggregateRoot,
    NewSessionParameters
} from "../../../src/logion/model/session.model";
import { Authenticator, Session, SessionManager, SessionSignature, SignedSession, Token } from "@logion/authenticator";
import { UnauthorizedException } from "dinoloop";

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
            signedOn: TIMESTAMP,
            type: "POLKADOT",
        };
        authenticateRequest.signatures![BOB] = {
            signature: "signature-BOB",
            signedOn: TIMESTAMP,
            type: "POLKADOT",
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
            signedOn: TIMESTAMP,
            type: "POLKADOT",
        };
        authenticateRequest.signatures![BOB] = {
            signature: "signature-BOB",
            signedOn: TIMESTAMP,
            type: "POLKADOT",
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
            signedOn: TIMESTAMP,
            type: "POLKADOT",
        };
        authenticateRequest.signatures![BOB] = {
            signature: "signature-BOB",
            signedOn: TIMESTAMP,
            type: "POLKADOT",
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
}

function mockDependenciesForAuth(container: Container, verifies: boolean, sessionExists:boolean): void {

    const sessionAlice = new Mock<SessionAggregateRoot>();
    sessionAlice.setup(instance => instance.createdOn).returns(DateTime.now().toJSDate());

    const authenticationService = new Mock<AuthenticationService>();
    container.rebind(AuthenticationService).toConstantValue(authenticationService.object());

    const sessionManager = new Mock<SessionManager>();
    const authenticator = new Mock<Authenticator>();

    authenticationService.setup(instance => instance.authenticationSystem()).returnsAsync({
        sessionManager: sessionManager.object(),
        authenticator: authenticator.object(),
    });

    const session = new Mock<Session>();
    session.setup(instance => instance.addresses).returns([ ALICE, BOB ]);

    if(verifies) {
        const signatures: Record<string, SessionSignature> = {
            [ ALICE ]: {
                signature: "SIG_ALICE",
                signedOn: DateTime.now(),
                type: "POLKADOT",
            },
            [ BOB ]: {
                signature: "SIG_BOB",
                signedOn: DateTime.now(),
                type: "POLKADOT",
            }
        };
        sessionManager.setup(instance => instance.signedSessionOrThrow(It.IsAny(), It.IsAny())).returnsAsync({
            session: session.object(),
            signatures
        });
        const tokens: Record<string, Token> = {
            [ALICE]: {
                value: TOKEN_ALICE,
                expiredOn: DateTime.now(),
            },
            [BOB]: {
                value: TOKEN_BOB,
                expiredOn: DateTime.now(),
            }
        };
        authenticator.setup(instance => instance.createTokens(It.Is<SignedSession>(
            args => args.session === session.object() && args.signatures === signatures
        ), It.IsAny())).returnsAsync(tokens);
    } else {
        sessionManager.setup(instance => instance.signedSessionOrThrow)
            .returns(() => { throw new UnauthorizedException({error: "Invalid signature"}) });
    }

    const sessionRepository = new Mock<SessionRepository>();
    if (sessionExists) {
        sessionRepository.setup(instance => instance.find(ALICE, SESSION_ID))
            .returns(Promise.resolve(sessionAlice.object()))
        sessionRepository.setup(instance => instance.find(BOB, SESSION_ID))
            .returns(Promise.resolve(sessionAlice.object()))
    } else {
        sessionRepository.setup(instance => instance.find(ALICE, SESSION_ID))
            .returns(Promise.resolve(null))
        sessionRepository.setup(instance => instance.find(BOB, SESSION_ID))
            .returns(Promise.resolve(null))
    }
    container.bind(SessionRepository).toConstantValue(sessionRepository.object());
    sessionRepository.setup(instance => instance.delete)
        .returns(() => Promise.resolve())

    const sessionFactory = new Mock<SessionFactory>();
    container.bind(SessionFactory).toConstantValue(sessionFactory.object());
}
