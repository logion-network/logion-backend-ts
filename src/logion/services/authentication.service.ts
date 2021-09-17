import jwt, { Algorithm, Jwt, VerifyErrors } from "jsonwebtoken";
import { injectable } from "inversify";
import { Request } from "express";
import { UnauthorizedException } from "dinoloop/modules/builtin/exceptions/exceptions";
import { ALICE, BOB } from "../model/addresses.model";
import moment, { Moment } from "moment";

const ALGORITHM: Algorithm = "HS384";

export interface LogionUser {
    address: string,
    legalOfficer: boolean;
}

export class LogionUserCheck implements LogionUser {
    constructor(logionUser: LogionUser) {
        this.address = logionUser.address;
        this.legalOfficer = logionUser.legalOfficer;
    }

    requireLegalOfficer(): void {
        if (!this.legalOfficer) {
            throw unauthorized("Reserved to legal officer")
        }
    }

    readonly address: string;
    readonly legalOfficer: boolean;
}

export interface Token {
    value: string,
    expiredOn: Moment
}

export function unauthorized(error: string): UnauthorizedException<{ error: string }> {
    return new UnauthorizedException({ error: error });
}

@injectable()
export class AuthenticationService {

    authenticatedUserIs(request: Request, address: string | undefined | null): LogionUserCheck {
        const user = this.extractLogionUser(request);
        if (this.equal(user, address)) {
            return new LogionUserCheck(user);
        }
        throw unauthorized("User has not access to this resource");
    }

    authenticatedUserIsOneOf(request: Request, ...addresses: (string | undefined | null)[]): LogionUserCheck {
        const user = this.extractLogionUser(request);
        if (addresses.some(address => this.equal(user, address))) {
            return new LogionUserCheck(user);
        }
        throw unauthorized("User has not access to this resource");
    }

    private equal(user: LogionUser, address: string | undefined | null): boolean {
        return address !== undefined
            && address !== null
            && address === user.address;
    }

    private extractLogionUser(request: Request): LogionUser {
        const header = request.header("Authorization");
        if (header === undefined || !header.startsWith("Bearer ")) {
            throw unauthorized("Invalid Authorization header");
        }
        const jwtToken = header.split(' ')[1].trim();
        jwt.verify(jwtToken, this.secret, { issuer: this.issuer }, err => {
            if (err) {
                throw this._unauthorized(err)
            }
        });
        const token = jwt.decode(jwtToken, { complete: true }) as Jwt;
        return {
            address: token.payload.sub!,
            legalOfficer: token.payload.legalOfficer
        }
    }

    private readonly secret: Buffer;
    private readonly issuer: string;
    private readonly ttl: number;

    constructor() {
        if (process.env.JWT_SECRET === undefined) {
            throw Error("No JWT secret set, please set var JWT_SECRET");
        }
        if (process.env.JWT_ISSUER === undefined) {
            throw Error("No JWT issuer set, please set var JWT_ISSUER");
        }
        if (process.env.JWT_TTL_SEC === undefined) {
            throw Error("No JWT Time-to-live set, please set var JWT_TTL_SEC");
        }
        const bas64EncodedSecret = process.env.JWT_SECRET as string;
        this.secret = Buffer.from(bas64EncodedSecret, 'base64')
        this.issuer = process.env.JWT_ISSUER;
        this.ttl = parseInt(process.env.JWT_TTL_SEC);
    }

    createToken(address: string, issuedAt: Moment, expiresIn?: number): Token {
        const now = Math.floor(issuedAt.unix());
        const expiredOn = now + (expiresIn !== undefined ? expiresIn : this.ttl);
        const payload = {
            iat: now,
            legalOfficer: this.isLegalOfficer(address),
            exp: expiredOn
        };
        const encodedToken = jwt.sign(payload, this.secret, {
            algorithm: ALGORITHM,
            issuer: this.issuer,
            subject: address
        });
        return { value: encodedToken, expiredOn: moment.unix(expiredOn) };
    }

    private isLegalOfficer(address: string): boolean {
        return address === ALICE || address === BOB;
    }

    private _unauthorized(error: VerifyErrors): UnauthorizedException<{ error: string }> {
        return new UnauthorizedException({ error: error.name + ": " + error.message });
    }
}
