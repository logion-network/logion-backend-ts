import { injectable } from "inversify";
import { Request } from "express";
import { UnauthorizedException } from "dinoloop/modules/builtin/exceptions/exceptions";
import moment, { Moment } from "moment";
import { AuthorityService } from "./authority.service";
import PeerId from "peer-id";
import { KeyObject, createPublicKey, createPrivateKey } from "crypto";
import { base64url, SignJWT, decodeJwt, jwtVerify, JWTPayload } from "jose";
import { JWTVerifyResult } from "jose/dist/types/types";
import { NodeAuthorizationService } from "./nodeauthorization.service";

const ALGORITHM = "EdDSA";

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

    async authenticatedUser(request: Request): Promise<LogionUserCheck> {
        const user = await this.extractLogionUser(request);
        return new LogionUserCheck(user, this.nodeOwner, address => isLegalOfficer(this.authorityService, address));
    }

    async authenticatedUserIs(request: Request, address: string | undefined | null): Promise<LogionUserCheck> {
        const user = await this.authenticatedUser(request);
        if (user.is(address)) {
            return user;
        }
        throw unauthorized("User has not access to this resource");
    }

    async authenticatedUserIsOneOf(request: Request, ...addresses: (string | undefined | null)[]): Promise<LogionUserCheck> {
        const user = await this.authenticatedUser(request);
        if (user.isOneOf(addresses)) {
            return user;
        }
        throw unauthorized("User has not access to this resource");
    }

    async refreshToken(jwtToken: string): Promise<Token> {
        const authenticatedUser = await this.verifyToken(jwtToken)
        return await this.createToken(authenticatedUser.address, moment())
    }

    private async extractLogionUser(request: Request): Promise<AuthenticatedUser> {
        const jwtToken = this.extractBearerToken(request);
        return await this.verifyToken(jwtToken)
    }

    private async verifyToken(jwtToken: string): Promise<AuthenticatedUser> {

        let payload:JWTPayload;
        try {
            payload = decodeJwt(jwtToken)
        } catch (error) {
            throw unauthorized("" + error)
        }
        const issuer = payload.iss;
        if (!issuer || ! await this.nodeAuthorizationService.isWellKnownNode(issuer)) {
            throw unauthorized("Invalid issuer");
        }

        const publicKey = this.createPublicKey(issuer)
        let result: JWTVerifyResult;
        try {
            result = await jwtVerify(jwtToken, publicKey, { algorithms: [ ALGORITHM ] });
        } catch (error) {
            throw unauthorized("" + error)
        }
        const address = result.payload.sub;
        if (!address) {
            throw unauthorized("Unable to find issuer in payload");
        }
        return { address }
    }

    private extractBearerToken(request: Request): string {
        const header = request.header("Authorization");
        if (header === undefined || !header.startsWith("Bearer ")) {
            throw unauthorized("Invalid Authorization header");
        }
        return header.split(' ')[1].trim();
    }

    private readonly privateKey: KeyObject
    private readonly issuer: string;
    private readonly ttl: number;
    readonly nodeOwner: string;

    constructor(
        public authorityService: AuthorityService,
        public nodeAuthorizationService: NodeAuthorizationService,
    ) {
        if (process.env.JWT_SECRET === undefined) {
            throw Error("No JWT secret set, please set var JWT_SECRET equal to NODE_SECRET_KEY");
        }
        if (process.env.JWT_ISSUER === undefined) {
            throw Error("No JWT issuer set, please set var JWT_ISSUER equal to NODE_PEER_ID (base58 encoding)");
        }
        if (process.env.JWT_TTL_SEC === undefined) {
            throw Error("No JWT Time-to-live set, please set var JWT_TTL_SEC");
        }
        if (process.env.OWNER === undefined) {
            throw Error("No node owner set, please set var OWNER");
        }
        this.issuer = process.env.JWT_ISSUER;
        this.privateKey = this.createPrivateKey(this.publicKeyBytes(this.issuer), process.env.JWT_SECRET)
        this.ttl = parseInt(process.env.JWT_TTL_SEC);
        this.nodeOwner = process.env.OWNER;
    }

    private publicKeyBytes(issuer: string): Uint8Array {
        const peerId = PeerId.createFromB58String(issuer);
        return peerId.pubKey.bytes.slice(4, 36)
    }

    private createPrivateKey(publicKeyBytes: Uint8Array, nodeKey: string): KeyObject {
        const privateKeyBytes = Buffer.from(nodeKey, "hex");

        return createPrivateKey({
            key: {
                kty: "OKP",
                crv: "Ed25519",
                x: base64url.encode(publicKeyBytes),
                d: base64url.encode(privateKeyBytes),
            },
            format: "jwk"
        })
    }

    private createPublicKey(issuer: string): KeyObject {

        return createPublicKey({
            key: {
                kty: "OKP",
                crv: "Ed25519",
                x: base64url.encode(this.publicKeyBytes(issuer))
            },
            format: "jwk"
        });
    }

    async createToken(address: string, issuedAt: Moment, expiresIn?: number): Promise<Token> {
        const now = Math.floor(issuedAt.unix());
        const expiredOn = now + (expiresIn !== undefined ? expiresIn : this.ttl);
        const encodedToken = await new SignJWT({})
            .setProtectedHeader({ alg: ALGORITHM })
            .setIssuedAt(now)
            .setExpirationTime(expiredOn)
            .setIssuer(this.issuer)
            .setSubject(address)
            .sign(this.privateKey)

        return { value: encodedToken, expiredOn: moment.unix(expiredOn) };
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
