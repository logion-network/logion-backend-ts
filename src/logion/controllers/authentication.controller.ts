import { injectable } from "inversify";
import { Controller, ApiController, HttpPost, Async } from "dinoloop";
import { components } from "./components";
import { v4 as uuid } from "uuid";
import { AuthenticationService, Token, unauthorized } from "../services/authentication.service";
import { SessionRepository, SessionFactory } from "../model/session.model";
import moment from "moment";
import { requireDefined } from "../lib/assertions";
import { SignatureService } from "../services/signature.service";
import { OpenAPIV3 } from "express-oas-generator";
import { getRequestBody, getBodyContent, getDefaultResponses, addPathParameter, addTag, setControllerTag } from "./doc";

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

@injectable()
@Controller('/auth')
export class AuthenticationController extends ApiController {

    static readonly RESOURCE = "authentication";

    constructor(
        private sessionRepository: SessionRepository,
        private sessionFactory: SessionFactory,
        private signatureService: SignatureService,
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
        signInRequest.addresses?.forEach(address => {
                const session = this.sessionFactory.newSession({
                    userAddress: address,
                    sessionId,
                    createdOn
                });
                this.sessionRepository.save(session);
            }
        )
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
        addPathParameter(operationObject, 'sessionId', "The ID of the session to authenticate");
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

    private async authenticateSession(address: string, sessionId: string, signature: SignatureView): Promise<Token> {
        const session = await this.sessionRepository.find(address, sessionId);
        if (session === undefined) {
            throw unauthorized("Invalid session")
        }
        await this.sessionRepository.delete(session);
        if (!await this.signatureService.verify({
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
