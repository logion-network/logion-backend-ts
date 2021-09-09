import jwt, { Algorithm, Jwt, VerifyErrors } from "jsonwebtoken";
import { injectable } from "inversify";
import { Request } from "express";
import { UnauthorizedException } from "dinoloop/modules/builtin/exceptions/exceptions";
import { ALICE, BOB } from "../model/addresses.model";

const ISSUER = "dev.logion.network";
const TTL = 3600;
const ALGORITHM: Algorithm = "HS384";

export interface LogionUser {
    address: string,
    legalOfficer: boolean;
}

export class LogionUserCheck {
    constructor(private logionUser: LogionUser) {
    }

    requireLegalOfficer(): void {
        if (!this.logionUser.legalOfficer) {
            throw unauthorized("Reserved to legal officer")
        }
    }
}

function unauthorized(error: string | VerifyErrors): UnauthorizedException<{ error: string | VerifyErrors }> {
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
        jwt.verify(jwtToken, this.secret, { issuer: ISSUER }, err => {
            if (err) {
                throw unauthorized(err)
            }
        });
        const token = jwt.decode(jwtToken, { complete: true }) as Jwt;
        return {
            address: token.payload.sub!,
            legalOfficer: token.payload.legalOfficer
        }
    }

    private readonly secret: Buffer;

    constructor() {
        const bas64EncodedSecret = process.env.JWT_SECRET as string;
        this.secret = Buffer.from(bas64EncodedSecret, 'base64')
    }

    createToken(address: string, issuedAt: number, expiresIn?: number): string {
        const now = Math.floor(issuedAt / 1000);
        const payload = {
            iat: now,
            legalOfficer: this.isLegalOfficer(address)
        };
        return jwt.sign(payload, this.secret, {
            algorithm: ALGORITHM,
            expiresIn: expiresIn !== undefined ? expiresIn : TTL,
            issuer: ISSUER,
            subject: address
        });
    }

    private isLegalOfficer(address: string): boolean {
        return address === ALICE || address === BOB;
    }
}

