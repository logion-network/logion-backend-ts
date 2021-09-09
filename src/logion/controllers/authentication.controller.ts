import { injectable } from "inversify";
import { Controller, ApiController, HttpPost, Async } from "dinoloop";
import { components } from "./components";
import { v4 as uuid } from "uuid";
import { AuthenticationService } from "../services/authentication.service";

type SignInRequestView = components["schemas"]["SignInRequestView"];
type SignInResponseView = components["schemas"]["SignInResponseView"];
type AuthenticateRequestView = components["schemas"]["AuthenticateRequestView"];
type AuthenticateResponseView = components["schemas"]["AuthenticateResponseView"];
type SignatureView = components["schemas"]["SignatureView"];


@injectable()
@Controller('/auth')
export class AuthenticationController extends ApiController {

    constructor(
        private authenticationService: AuthenticationService) {
        super();
    }

    @HttpPost('/sign-in')
    @Async()
    async signIn(signInRequest: SignInRequestView): Promise<SignInResponseView> {
        return Promise.resolve({ sessionId: uuid() });
    }

    @HttpPost('/:sessionId/authenticate')
    @Async()
    async authenticate(authenticateRequest: AuthenticateRequestView): Promise<AuthenticateResponseView> {
        let response: AuthenticateResponseView = { tokens: {} };
        for (let address in authenticateRequest.signatures) {
            const signature: SignatureView = authenticateRequest.signatures[address];
            // TODO Validate signature against session id
            response.tokens![address] = this.authenticationService.createToken(address, Date.now());
        }
        return Promise.resolve(response);
    }
}
