import { AuthenticatedUser, AuthenticationSystem } from "@logion/authenticator";
import { injectable } from "inversify";
import { Request } from "express";
import { UnauthorizedException } from "dinoloop/modules/builtin/exceptions/exceptions";
import { AuthenticationSystemFactory, unauthorized } from "./authenticationsystemfactory.service";

@injectable()
export class AuthenticationService {

    authenticationSystem(): Promise<AuthenticationSystem> {
        return this.authenticationSystemFactory.authenticationSystem();
    }

    async authenticatedUser(request: Request): Promise<AuthenticatedUser> {
        const jwtToken = this.extractBearerToken(request);
        const { authenticator } = await this.authenticationSystemFactory.authenticationSystem();
        return authenticator.ensureAuthenticatedUserOrThrow(jwtToken);
    }

    async authenticatedUserIs(request: Request, address: string | undefined | null): Promise<AuthenticatedUser> {
        const user = await this.authenticatedUser(request);
        user.require(user => user.is(address), "User has not access to this resource");
        return user;
    }

    async authenticatedUserIsOneOf(request: Request, ...addresses: (string | undefined | null)[]): Promise<AuthenticatedUser> {
        const user = await this.authenticatedUser(request);
        user.require(user => user.isOneOf(addresses), "User has not access to this resource");
        return user;
    }

    private extractBearerToken(request: Request): string {
        const header = request.header("Authorization");
        if (header && header.startsWith("Bearer ")) {
            return header.split(' ')[1].trim();
        } else if(request.query) {
            const token = request.query['jwt_token'];
            if(typeof token === "string") {
                return token;
            } else {
                throw unauthorized("No token found");
            }
        } else {
            throw unauthorized("No token found");
        }
    }

    constructor(
        private authenticationSystemFactory: AuthenticationSystemFactory,
    ) {}

    ensureAuthorizationBearer(request: Request, expectedToken: string | undefined) {
        if(expectedToken === undefined) {
            throw new UnauthorizedException("No expected token");
        }
        const token = this.extractBearerToken(request);
        if(token !== expectedToken) {
            throw new UnauthorizedException("Unexpected Bearer token");
        }
    }

    get nodeOwner(): string {
        return this.authenticationSystemFactory.nodeOwner;
    }
}
