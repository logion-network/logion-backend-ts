import { injectable } from "inversify";
import { Controller, ApiController, HttpPost, Async, HttpPut } from "dinoloop";
import { components } from "./components";
import { v4 as uuid } from "uuid";
import { AuthenticationService, Token, unauthorized } from "../services/authentication.service";
import { SessionRepository, SessionFactory } from "../model/session.model";
import moment from "moment";
import { requireDefined } from "../lib/assertions";
import { PolkadotSignatureService, EthereumSignatureService } from "../services/signature.service";
import { OpenAPIV3 } from "express-oas-generator";
import {
    getRequestBody,
    getBodyContent,
    getDefaultResponses,
    setPathParameters,
    addTag,
    setControllerTag
} from "./doc";
import { Log } from "../util/Log";

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
type SignatureView = components["schemas"]["SignatureView"];
type RefreshRequestView = components["schemas"]["RefreshRequestView"];

@injectable()
@Controller('/auth')
export class AuthenticationController extends ApiController {

    static readonly RESOURCE = "authentication";

    constructor(
        private sessionRepository: SessionRepository,
        private sessionFactory: SessionFactory,
        private signatureService: PolkadotSignatureService,
        private ethereumSignatureService: EthereumSignatureService,
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
        const sessionId = uuid();
        const createdOn = moment();
        for(const address of signInRequest.addresses!) {
            const session = this.sessionFactory.newSession({
                userAddress: address,
                sessionId,
                createdOn
            });
            await this.sessionRepository.save(session);
        }
        return Promise.resolve({ sessionId });
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
        sessionId: string): Promise<AuthenticateResponseView> {

        let response: AuthenticateResponseView = { tokens: {} };
        for (let address in authenticateRequest.signatures) {
            const signature: SignatureView = authenticateRequest.signatures[address];
            const token = await this.authenticateSession(address, sessionId, signature);
            response.tokens![address] = { value: token.value, expiredOn: token.expiredOn.toISOString() }
        }
        return Promise.resolve(response);
    }

    @HttpPut('/refresh')
    @Async()
    async refresh(refreshRequest: RefreshRequestView): Promise<AuthenticateResponseView> {

        let response: AuthenticateResponseView = { tokens: {} };
        for (let address in refreshRequest.tokens) {
            const oldToken = refreshRequest.tokens[address];
            try {
                const refreshedToken = await this.authenticationService.refreshToken(oldToken)
                response.tokens![address] = { value: refreshedToken.value, expiredOn: refreshedToken.expiredOn.toISOString() }
            } catch (e) {
                logger.warn("Failed to refresh token for %s: %s", address, e)
            }
        }
        return Promise.resolve(response);
    }

    private async authenticateSession(address: string, sessionId: string, signature: SignatureView): Promise<Token> {
        const session = await this.sessionRepository.find(address, sessionId);
        if (session === null) {
            throw unauthorized("Invalid session")
        }
        await this.sessionRepository.delete(session);
        const signatureService = signature.type === 'ETHEREUM' ?
            this.ethereumSignatureService :
            this.signatureService;
        if (!await signatureService.verify({
            signature: requireDefined(signature.signature),
            address: address,
            resource: AuthenticationController.RESOURCE,
            operation: "login",
            timestamp: requireDefined(signature.signedOn),
            attributes: [ sessionId ]
        })) {
            throw unauthorized("Invalid signature");
        } else {
            return this.authenticationService.createToken(address, moment());
        }
    }
}
