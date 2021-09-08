import jwt, { Algorithm } from "jsonwebtoken";
import { injectable } from "inversify";
import { Express, Request, Response, NextFunction } from "express";
import { StrategyOptions, ExtractJwt, Strategy } from "passport-jwt";
import passport from "passport";
import { Log } from "../util/Log";

const AUTH_SECRET = "secret-key-that-should-never-be-disclosed-to-anybody-especially-the-bad-guys";
const AUTH_ISSUER = "dev.logion.network";
const TTL = 3600;
const ALGORITHM: Algorithm = "HS384";
const SECRET = Buffer.from(AUTH_SECRET, 'base64');

const { logger } = Log;

interface LogionUser {
    account: string,
    legalOfficer: boolean;
}

@injectable()
export class AuthenticationService {

    createToken(address: string): string {
        const now = Math.floor(Date.now() / 1000);
        const payload = {
            iat: now,
            exp: now + TTL,
            legalOfficer: true
        };
        return jwt.sign(payload, SECRET, {
            algorithm: ALGORITHM,
            issuer: AUTH_ISSUER,
            subject: address
        });
    }
}

@injectable()
export class AuthenticationConfigurationService {

    private configureEndpoints(app: Express, authenticate: any, authorizeForLegalOfficer: any): void {

        app.all("/api/protection-request/*", authenticate)
        app.post("/api/protection-request/:id/accept", authenticate, authorizeForLegalOfficer)
        app.post("/api/protection-request/:id/reject", authenticate, authorizeForLegalOfficer)

        app.all("/api/token-request/*", authenticate)
        app.post("/api/token-request/:id/accept", authenticate, authorizeForLegalOfficer)
        app.post("/api/token-request/:id/reject", authenticate, authorizeForLegalOfficer)
        app.post("/api/token-request/:id/asset", authenticate, authorizeForLegalOfficer)

        app.all("/api/transaction/*", authenticate)
    }

    configureAuthentication(app: Express): void {

        logger.info("Configuring authentication");

        const options: StrategyOptions = {
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            issuer: AUTH_ISSUER,
            secretOrKey: SECRET
        }

        const jwtStrategy = new Strategy(options, ((payload, done) => {
            logger.debug("Authenticating...");
            const account = payload.sub;
            if (account === undefined || account === null || account.length != 48) {
                return done(null, false);
            }
            const logionUser: LogionUser = {
                account: account,
                legalOfficer: payload.legalOfficer
            }
            logger.debug("%s legalOfficer=%s", logionUser.account, logionUser.legalOfficer);
            return done(null, logionUser);
        }));
        passport.use(jwtStrategy)

        const authenticate = passport.authenticate(jwtStrategy, { session: false });

        const authorizeForLegalOfficer = (request: Request, response: Response, next: NextFunction) => {
            logger.debug("Authorizing...");
            const user = request.user as LogionUser;
            logger.debug("Detected account: %s", user.account)
            if (!user.legalOfficer) {
                response.status(401)
                    .send({ error: "Authorized only for legal officers" })
            } else {
                next()
            }
        };

        this.configureEndpoints(app, authenticate, authorizeForLegalOfficer);
    }
}

