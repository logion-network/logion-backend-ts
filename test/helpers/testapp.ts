import '../../src/logion/container/inversify.decorate';
import express, { Express } from 'express';
import bodyParser from 'body-parser';
import fileUpload from 'express-fileupload';
import { Dino } from 'dinoloop';
import { Container } from 'inversify';
import { ApplicationErrorController } from '../../src/logion/controllers/application.error.controller';
import { JsonResponse } from '../../src/logion/middlewares/json.response';
import { Mock } from "moq.ts";
import { AuthenticationService, LogionUserCheck } from "../../src/logion/services/authentication.service";
import { UnauthorizedException } from "dinoloop/modules/builtin/exceptions/exceptions";
import { ALICE } from "./addresses";

export function setupApp<T>(
    controller: Function & { prototype: T; },
    mockBinder: (container: Container) => void,
    authSucceed: boolean = true,
    isNodeOwner: boolean = true,
    conditionFulfilled: boolean = true
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

    container.bind(AuthenticationService)
        .toConstantValue(authSucceed ? mockAuthenticationSuccess(isNodeOwner, conditionFulfilled) : mockAuthenticationFailure());

    mockBinder(container);

    dino.dependencyResolver<Container>(container,
        (injector, type) => {
            return injector.resolve(type);
        });

    dino.bind();

    return app;
}

function mockAuthenticationSuccess(isNodeOwner: boolean, conditionFulfilled: boolean): AuthenticationService {

    const authenticatedUser = new Mock<LogionUserCheck>();
    authenticatedUser.setup(instance => instance.address).returns(ALICE);
    authenticatedUser.setup(instance => instance.is).returns(() => conditionFulfilled);
    authenticatedUser.setup(instance => instance.require).returns(() => {
        if (!conditionFulfilled) {
            throw new UnauthorizedException("")
        }
        return authenticatedUser.object()
    });
    authenticatedUser.setup(instance => instance.requireIs).returns(() => {
        if (!conditionFulfilled) {
            throw new UnauthorizedException("")
        }
    });
    authenticatedUser.setup(instance => instance.requireNodeOwner).returns(() => {
        if (!isNodeOwner) {
            throw new UnauthorizedException("")
        }
        return Promise.resolve()
    });
    authenticatedUser.setup(instance => instance.isNodeOwner).returns(() => isNodeOwner);

    const authenticationService = new Mock<AuthenticationService>();
    authenticationService.setup(instance => instance.authenticatedUserIs)
        .returns(() => Promise.resolve(authenticatedUser.object()));
    authenticationService.setup(instance => instance.authenticatedUserIsOneOf)
        .returns(() => Promise.resolve(authenticatedUser.object()));
    authenticationService.setup(instance => instance.authenticatedUser)
        .returns(() => Promise.resolve(authenticatedUser.object()));
    authenticationService.setup(instance => instance.nodeOwner)
        .returns(ALICE);
    return authenticationService.object();
}

function mockAuthenticationFailure(): AuthenticationService {

    const authenticationService = new Mock<AuthenticationService>();
    authenticationService.setup(instance => instance.authenticatedUserIs)
        .returns(() => {
            throw new UnauthorizedException();
        });
    authenticationService.setup(instance => instance.authenticatedUserIsOneOf)
        .returns(() => {
            throw new UnauthorizedException();
        });

    const authenticatedUser = new Mock<LogionUserCheck>();
    authenticatedUser.setup(instance => instance.require).returns(() => {
        throw new UnauthorizedException();
    });

    authenticationService.setup(instance => instance.authenticatedUser)
        .returns(() => Promise.resolve(authenticatedUser.object()));
    authenticationService.setup(instance => instance.nodeOwner).returns(ALICE);
    return authenticationService.object();
}
