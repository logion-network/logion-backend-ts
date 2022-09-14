import { Session, SessionSignature, Token } from "@logion/authenticator";
import { Controller, ApiController, HttpPost, Async, HttpPut } from "dinoloop";
import { OpenAPIV3 } from "express-oas-generator";
import { injectable } from "inversify";
import { DateTime } from "luxon";

import { components } from "./components";
import { AuthenticationService } from "../services/authentication.service";
import { SessionRepository, SessionFactory } from "../model/session.model";
import { requireDefined } from "../lib/assertions";
import {
    getRequestBody,
    getBodyContent,
    getDefaultResponses,
    setPathParameters,
    addTag,
    setControllerTag
} from "./doc";
import { Log } from "../util/Log";
import { unauthorized } from "../services/authenticationsystemfactory.service";

const { logger } = Log;

export function fillInSpec(spec: OpenAPIV3.Document): void {
    const tagName = 'Authentication';
    addTag(spec, {
        name: tagName,
        description: "Handling of session authentication"
    });
    setControllerTag(spec, /^\/api\/auth.*/, tagName);

    AuthenticationController.signIn(spec);
    AuthenticationController.authenticate(spec);
}

type SignInRequestView = components["schemas"]["SignInRequestView"];
type SignInResponseView = components["schemas"]["SignInResponseView"];
type AuthenticateRequestView = components["schemas"]["AuthenticateRequestView"];
type AuthenticateResponseView = components["schemas"]["AuthenticateResponseView"];
type RefreshRequestView = components["schemas"]["RefreshRequestView"];

@injectable()
@Controller('/auth')
export class AuthenticationController extends ApiController {

    static readonly RESOURCE = "authentication";

    constructor(
        private sessionRepository: SessionRepository,
        private sessionFactory: SessionFactory,
        private authenticationService: AuthenticationService) {
        super();
    }

    static signIn(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/auth/sign-in"].post!;
        operationObject.summary = "Sign-in for a new session";
        operationObject.description = "No signature required";
        operationObject.requestBody = getRequestBody({
            description: "Session creation data",
            view: "SignInRequestView"
        })
        operationObject.responses = {"200": {
                description: "OK",
                content: getBodyContent("SignInResponseView"),
            }};
    }

    @HttpPost('/sign-in')
    @Async()
    async signIn(signInRequest: SignInRequestView): Promise<SignInResponseView> {
        const { sessionManager } = await this.authenticationService.authenticationSystem();
        const session = sessionManager.createNewSession(signInRequest.addresses!);
        for(const address of session.addresses) {
            const sessionAggregate = this.sessionFactory.newSession({
                userAddress: address,
                sessionId: session.id,
                createdOn: session.createdOn,
            });
            await this.sessionRepository.save(sessionAggregate);
        }
        return Promise.resolve({ sessionId: session.id });
    }

    static authenticate(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/auth/{sessionId}/authenticate"].post!;
        operationObject.summary = "Authenticate the given session";
        operationObject.description = "<p>The signature's resource is <code>authentication</code>, the operation <code>login</code> and the additional field is <code>sessionId</code><p>";
        operationObject.requestBody = getRequestBody({
            description: "Authentication data",
            view: "AuthenticateRequestView",
        });
        operationObject.responses = getDefaultResponses("AuthenticateResponseView");
        setPathParameters(operationObject, { 'sessionId': "The ID of the session to authenticate" });
    }

    @HttpPost('/:sessionId/authenticate')
    @Async()
    async authenticate(
        authenticateRequest: AuthenticateRequestView,
        sessionId: string
    ): Promise<AuthenticateResponseView> {

        const { session, signatures } = await this.sessionAndSignatures(authenticateRequest, sessionId);
        const { sessionManager, authenticator } = await this.authenticationService.authenticationSystem();

        const signedSession = await sessionManager.signedSessionOrThrow(session, signatures);
        const tokens = await authenticator.createTokens(signedSession, DateTime.now());

        return this.toAuthenticateResponseView(tokens);
    }

    private async sessionAndSignatures(
        authenticateRequest: AuthenticateRequestView,
        sessionId: string
    ): Promise<{ session: Session, signatures: Record<string, SessionSignature> }> {
        const signatures: Record<string, SessionSignature> = {};
        let createdOn: DateTime | undefined;
        for (let address in authenticateRequest.signatures) {
            createdOn = await this.clearSession(address, sessionId);

            const signature = authenticateRequest.signatures[address];
            signatures[address] = {
                signature: requireDefined(signature.signature),
                signedOn: DateTime.fromISO(requireDefined(signature.signedOn), {setZone: true}),
                type: requireDefined(signature.type),
            };
        }
        const session: Session = {
            addresses: Object.keys(signatures),
            createdOn: DateTime.now(),
            id: sessionId,
        };
        return { session, signatures };
    }

    private async clearSession(address: string, sessionId: string): Promise<DateTime> {
        const session = await this.sessionRepository.find(address, sessionId);
        if (session === null) {
            throw unauthorized("Invalid session")
        }
        await this.sessionRepository.delete(session);
        return DateTime.fromJSDate(requireDefined(session.createdOn));
    }

    private toAuthenticateResponseView(tokens: Record<string, Token>): AuthenticateResponseView {
        let response: AuthenticateResponseView = { tokens: {} };
        for (let address in tokens) {
            const token = tokens[address];
            response.tokens![address] = {
                value: token.value,
                expiredOn: token.expiredOn.toISO({ includeOffset: false }),
            }
        }
        return response;
    }

    @HttpPut('/refresh')
    @Async()
    async refresh(refreshRequest: RefreshRequestView): Promise<AuthenticateResponseView> {
        const { authenticator } = await this.authenticationService.authenticationSystem();
        let response: AuthenticateResponseView = { tokens: {} };
        for (let address in refreshRequest.tokens) {
            const oldToken = refreshRequest.tokens[address];
            try {
                const refreshedToken = await authenticator.refreshToken(oldToken);
                response.tokens![address] = { value: refreshedToken.value, expiredOn: refreshedToken.expiredOn.toISO({ includeOffset: false }) }
            } catch (e) {
                logger.warn("Failed to refresh token for %s: %s", address, e)
            }
        }
        return response;
    }
}
