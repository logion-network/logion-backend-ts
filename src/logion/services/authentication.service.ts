import jwt, { Algorithm, Jwt, VerifyErrors } from "jsonwebtoken";
import { injectable } from "inversify";
import { Request } from "express";
import { UnauthorizedException } from "dinoloop/modules/builtin/exceptions/exceptions";
import moment, { Moment } from "moment";
import { AuthorityService } from "./authority.service";

const ALGORITHM: Algorithm = "HS384";

export interface AuthenticatedUser {
    address: string,
}

export class LogionUserCheck implements AuthenticatedUser {
    constructor(
        logionUser: AuthenticatedUser,
        nodeOwner: string,
        legalOfficerChecker: (address: string) => Promise<boolean>
    ) {
        this.address = logionUser.address;
        this.nodeOwner = nodeOwner;
        this.legalOfficerChecker = legalOfficerChecker;
    }

    async requireNodeOwner(): Promise<void> {
        const legalOfficer = await this.legalOfficerChecker(this.address);
        this.require(user => user.isNodeOwner(this.address) && legalOfficer, "Reserved to node owner");
    }

    isNodeOwner(address?: string | null): boolean {
        if(address === undefined) {
            return this.nodeOwner === this.address;
        } else {
            return this.nodeOwner === address;
        }
    }

    requireIs(address: string | undefined | null): void {
        this.require(user => user.is(address), "User has not access to this resource");
    }

    is(address: string | undefined | null): boolean {
        return address !== undefined
            && address !== null
            && address === this.address;
    }

    require(predicate: (check: LogionUserCheck) => boolean, message?: string): LogionUserCheck {
        if(!predicate(this)) {
            throw unauthorized(message || "Unauthorized");
        }
        return this;
    }

    isOneOf(addresses: (string | undefined | null)[]): boolean {
        return addresses.some(address => this.is(address));
    }

    readonly address: string;
    private readonly nodeOwner: string;
    private readonly legalOfficerChecker: (address: string) => Promise<boolean>
}

export interface Token {
    value: string,
    expiredOn: Moment
}

export function unauthorized(error: string): UnauthorizedException<{ error: string }> {
    return new UnauthorizedException({ error: error });
}

async function isLegalOfficer(authorityService: AuthorityService, address: string): Promise<boolean> {
    return authorityService.isLegalOfficer(address)
}

@injectable()
export class AuthenticationService {

    authenticatedUser(request: Request): LogionUserCheck {
        const user = this.extractLogionUser(request);
        return new LogionUserCheck(user, this.nodeOwner, address => isLegalOfficer(this.authorityService, address));
    }

    authenticatedUserIs(request: Request, address: string | undefined | null): LogionUserCheck {
        const user = this.authenticatedUser(request);
        if (user.is(address)) {
            return user;
        }
        throw unauthorized("User has not access to this resource");
    }

    authenticatedUserIsOneOf(request: Request, ...addresses: (string | undefined | null)[]): LogionUserCheck {
        const user = this.authenticatedUser(request);
        if (user.isOneOf(addresses)) {
            return user;
        }
        throw unauthorized("User has not access to this resource");
    }

    async refreshToken(jwtToken: string): Promise<Token> {
        const authenticatedUser = this.verifyToken(jwtToken)
        return await this.createToken(authenticatedUser.address, moment())
    }

    private extractLogionUser(request: Request): AuthenticatedUser {
        const jwtToken = this.extractBearerToken(request);
        return this.verifyToken(jwtToken)
    }

    private verifyToken(jwtToken: string): AuthenticatedUser {
        jwt.verify(jwtToken, this.secret, { issuer: this.issuer }, err => {
            if (err) {
                throw this._unauthorized(err)
            }
        });
        const token = jwt.decode(jwtToken, { complete: true }) as Jwt;
        if(typeof token.payload !== 'string') {
            return { address: token.payload.sub! }
        } else {
            throw unauthorized("Unable to decode payload");
        }
    }

    private extractBearerToken(request: Request): string {
        const header = request.header("Authorization");
        if (header === undefined || !header.startsWith("Bearer ")) {
            throw unauthorized("Invalid Authorization header");
        }
        return header.split(' ')[1].trim();
    }

    private readonly secret: Buffer;
    private readonly issuer: string;
    private readonly ttl: number;
    readonly nodeOwner: string;

    constructor(
        public authorityService: AuthorityService,
    ) {
        if (process.env.JWT_SECRET === undefined) {
            throw Error("No JWT secret set, please set var JWT_SECRET");
        }
        if (process.env.JWT_ISSUER === undefined) {
            throw Error("No JWT issuer set, please set var JWT_ISSUER");
        }
        if (process.env.JWT_TTL_SEC === undefined) {
            throw Error("No JWT Time-to-live set, please set var JWT_TTL_SEC");
        }
        if (process.env.OWNER === undefined) {
            throw Error("No node owner set, please set var OWNER");
        }
        const bas64EncodedSecret = process.env.JWT_SECRET as string;
        this.secret = Buffer.from(bas64EncodedSecret, 'base64')
        this.issuer = process.env.JWT_ISSUER;
        this.ttl = parseInt(process.env.JWT_TTL_SEC);
        this.nodeOwner = process.env.OWNER;
    }

    async createToken(address: string, issuedAt: Moment, expiresIn?: number): Promise<Token> {
        const now = Math.floor(issuedAt.unix());
        const expiredOn = now + (expiresIn !== undefined ? expiresIn : this.ttl);
        const payload = {
            iat: now,
            exp: expiredOn
        };
        const encodedToken = jwt.sign(payload, this.secret, {
            algorithm: ALGORITHM,
            issuer: this.issuer,
            subject: address
        });
        return { value: encodedToken, expiredOn: moment.unix(expiredOn) };
    }

    private _unauthorized(error: VerifyErrors): UnauthorizedException<{ error: string }> {
        return new UnauthorizedException({ error: error.name + ": " + error.message });
    }

    ensureAuthorizationBearer(request: Request, expectedToken: string | undefined) {
        if(expectedToken === undefined) {
            throw new UnauthorizedException("No expected token");
        }
        const token = this.extractBearerToken(request);
        if(token !== expectedToken) {
            throw new UnauthorizedException("Unexpected Bearer token");
        }
    }
}
