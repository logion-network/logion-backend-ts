import '../../src/logion/container/inversify.decorate';
import express, { Express } from 'express';
import bodyParser from 'body-parser';
import fileUpload from 'express-fileupload';
import { Dino } from 'dinoloop';
import { Container } from 'inversify';
import { ApplicationErrorController } from '../../src/logion/controllers/application.error.controller';
import { JsonResponse } from '../../src/logion/middlewares/json.response';
import { Mock } from "moq.ts";
import { AuthenticationService, LogionUserCheck, LogionUser } from "../../src/logion/services/authentication.service";
import { UnauthorizedException } from "dinoloop/modules/builtin/exceptions/exceptions";
import { ALICE } from "../../src/logion/model/addresses.model";

const DEFAULT_AUTHENTICATED_USER = { address: ALICE, legalOfficer: true };

export function setupApp<T>(
    controller: Function & { prototype: T; },
    mockBinder: (container: Container) => void,
    authSucceed: boolean = true,
    authUser?: LogionUser
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

    const logionUser = authUser? authUser : DEFAULT_AUTHENTICATED_USER;
    container.bind(AuthenticationService)
        .toConstantValue(authSucceed ? mockAuthenticationSuccess(logionUser) : mockAuthenticationFailure());

    mockBinder(container);

    dino.dependencyResolver<Container>(container,
        (injector, type) => {
            return injector.resolve(type);
        });

    dino.bind();

    return app;
}

function mockAuthenticationSuccess(logionUser: LogionUser): AuthenticationService {

    const logionUserCheck = new LogionUserCheck(logionUser)

    const authenticationService = new Mock<AuthenticationService>();
    authenticationService.setup(instance => instance.authenticatedUserIs)
        .returns(() => logionUserCheck);
    authenticationService.setup(instance => instance.authenticatedUserIsOneOf)
        .returns(() => logionUserCheck);
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
    return authenticationService.object();
}


