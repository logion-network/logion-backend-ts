import { DateTime } from "luxon";
import '../../src/logion/container/inversify.decorate';
import express, { Express } from 'express';
import bodyParser from 'body-parser';
import fileUpload from 'express-fileupload';
import { Dino } from 'dinoloop';
import { Container } from 'inversify';
import { ApplicationErrorController } from '../../src/logion/controllers/application.error.controller';
import { JsonResponse } from '../../src/logion/middlewares/json.response';
import { It, Mock } from "moq.ts";
import { AuthenticationService } from "../../src/logion/services/authentication.service";
import { UnauthorizedException } from "dinoloop/modules/builtin/exceptions/exceptions";
import { ALICE } from "./addresses";
import { AuthenticatedUser, AuthenticationSystem, Authenticator, SessionManager } from '@logion/authenticator';

export function setupApp<T>(
    controller: Function & { prototype: T; },
    mockBinder: (container: Container) => void,
    mock?: AuthenticationServiceMock,
): Express {

    const app = express();
    app.use(bodyParser.json());
    app.use(fileUpload({
        limits: { fileSize: 50 * 1024 * 1024 },
        useTempFiles : true,
        tempFileDir : '/tmp/',
    }));

    const dino = new Dino(app, '/api');

    dino.useRouter(() => express.Router());
    dino.registerController(controller);
    dino.registerApplicationError(ApplicationErrorController);
    dino.requestEnd(JsonResponse);

    let container = new Container({ defaultScope: "Singleton" });

    container.bind(AuthenticationService).toConstantValue(mockAuthenticationService(mock ? mock : mockAuthenticationWithCondition(true)));

    mockBinder(container);

    dino.dependencyResolver<Container>(container,
        (injector, type) => {
            return injector.resolve(type);
        });

    dino.bind();

    return app;
}

export interface AuthenticationServiceMock {
    authenticatedUser: () => Promise<AuthenticatedUser>;
    authenticatedUserIs: () => Promise<AuthenticatedUser>;
    authenticatedUserIsOneOf: () => Promise<AuthenticatedUser>;
    nodeOwner: string;
    ensureAuthorizationBearer: () => void;
}

export function mockAuthenticationWithCondition(conditionFulfilled: boolean): AuthenticationServiceMock {
    const authenticatedUser = mockAuthenticatedUser(conditionFulfilled);
    const ensureAuthorizationBearerMock = () => {
        if (!conditionFulfilled) {
            throw new UnauthorizedException();
        }
    };
    return mockAuthenticationWithAuthenticatedUser(authenticatedUser, ensureAuthorizationBearerMock);
}

export function mockAuthenticationWithAuthenticatedUser(authenticatedUser: AuthenticatedUser, ensureAuthorizationBearer?: () => void): AuthenticationServiceMock {
    return {
        authenticatedUser: () => Promise.resolve(authenticatedUser),
        authenticatedUserIs: throwOrReturn(authenticatedUser.is(null), authenticatedUser),
        authenticatedUserIsOneOf: throwOrReturn(authenticatedUser.isOneOf([]), authenticatedUser),
        nodeOwner: ALICE,
        ensureAuthorizationBearer: ensureAuthorizationBearer ? ensureAuthorizationBearer : () => {},
    };
}

function throwOrReturn(condition: boolean, authenticatedUser: AuthenticatedUser): () => Promise<AuthenticatedUser> {
    return () => {
        if(condition) {
            return Promise.resolve(authenticatedUser);
        } else {
            throw new UnauthorizedException();
        }
    };
}

export function mockAuthenticationForUserOrLegalOfficer(isLegalOfficer: boolean) {
    const authenticatedUser = new Mock<AuthenticatedUser>();
    authenticatedUser.setup(instance => instance.is).returns(() => true);
    authenticatedUser.setup(instance => instance.isOneOf).returns(() => true);
    authenticatedUser.setup(instance => instance.require).returns((predicate) => {
        if(!predicate(authenticatedUser.object())) {
            throw new UnauthorizedException();
        } else {
            return authenticatedUser.object();
        }
    });
    authenticatedUser.setup(instance => instance.isNodeOwner()).returns(isLegalOfficer);
    return mockAuthenticationWithAuthenticatedUser(authenticatedUser.object());
}

function mockAuthenticationService(mock: AuthenticationServiceMock): AuthenticationService {
    const authenticationSystem = mockAuthenticationSystem(mock);
    const authenticationService = new Mock<AuthenticationService>();
    authenticationService.setup(instance => instance.authenticationSystem()).returnsAsync(authenticationSystem);
    authenticationService.setup(instance => instance.authenticatedUserIs).returns(mock.authenticatedUserIs);
    authenticationService.setup(instance => instance.authenticatedUserIsOneOf).returns(mock.authenticatedUserIsOneOf);
    authenticationService.setup(instance => instance.authenticatedUser).returns(mock.authenticatedUser);
    authenticationService.setup(instance => instance.nodeOwner).returns(mock.nodeOwner);
    authenticationService.setup(instance => instance.ensureAuthorizationBearer).returns(mock.ensureAuthorizationBearer);
    return authenticationService.object();
}

export function mockAuthenticatedUser(conditionFulfilled: boolean, address?: string): AuthenticatedUser {
    const authenticatedUser = new Mock<AuthenticatedUser>();
    authenticatedUser.setup(instance => instance.address).returns(address ? address : ALICE);
    authenticatedUser.setup(instance => instance.is).returns(() => conditionFulfilled);
    authenticatedUser.setup(instance => instance.isOneOf).returns(() => conditionFulfilled);
    authenticatedUser.setup(instance => instance.require).returns((predicate) => {
        if(!predicate(authenticatedUser.object())) {
            throw new UnauthorizedException();
        } else {
            return authenticatedUser.object();
        }
    });
    authenticatedUser.setup(instance => instance.isNodeOwner).returns(() => conditionFulfilled);
    return authenticatedUser.object();
}

function mockAuthenticationSystem(mock: AuthenticationServiceMock): AuthenticationSystem {
    const sessionManager = new Mock<SessionManager>();
    sessionManager.setup(instance => instance.createNewSession).returns(addresses => ({
        addresses,
        id: "testSessionId",
        createdOn: DateTime.now(),
    }));

    const authenticator = new Mock<Authenticator>();
    authenticator.setup(instance => instance.ensureAuthenticatedUserOrThrow).returns(() => mock.authenticatedUser());

    return {
        sessionManager: sessionManager.object(),
        authenticator: authenticator.object(),
    };
}
