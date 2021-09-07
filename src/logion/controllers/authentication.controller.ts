import { injectable } from "inversify";
import { Controller, ApiController, HttpPost, Async } from "dinoloop";
import { components } from "./components";
import { v4 as uuid } from "uuid";

type SignInRequestView = components["schemas"]["SignInRequestView"];
type SignInResponseView = components["schemas"]["SignInResponseView"];
type AuthenticateRequestView = components["schemas"]["AuthenticateRequestView"];
type AuthenticateResponseView = components["schemas"]["AuthenticateResponseView"];
type SignatureView = components["schemas"]["SignatureView"];

@injectable()
@Controller('/auth')
export class AuthenticationController extends ApiController {


    @HttpPost('/sign-in')
    @Async()
    async signIn(signInRequest: SignInRequestView): Promise<SignInResponseView> {
        return Promise.resolve({ sessionId: uuid() });
    }

    @HttpPost('/:sessionId/authenticate')
    @Async()
    async authenticate(authenticateRequest: AuthenticateRequestView): Promise<AuthenticateResponseView> {
        let response:AuthenticateResponseView = { tokens: {}};
        for (let address in authenticateRequest.signatures) {
            const signature: SignatureView = authenticateRequest.signatures[address];
            response.tokens![address] = "some-fake-token-for-" + address;
        }
        return Promise.resolve(response);
    }
}
