import { OpenAPIV3 } from "openapi-types";
import { setOpenApi3, loadSchemasIntoSpec } from "./controllers/doc";
import {
    fillInSpec as fillInSpecForProtectionController,
    ProtectionRequestController
} from "./controllers/protectionrequest.controller";
import { fillInSpec as fillInSpecForTransaction, TransactionController } from "./controllers/transaction.controller";
import {
    fillInSpec as fillInSpecForAuthentication,
    AuthenticationController
} from "./controllers/authentication.controller";
import { fillInSpec as fillInSpecForLoc, LocRequestController } from "./controllers/locrequest.controller";
import { fillInSpec as fillInSpecForHealth, HealthController } from "./controllers/health.controller";
import express, { Express } from "express";
import bodyParser from "body-parser";
import fileUpload from "express-fileupload";
import cors from "cors";
import { Dino } from "dinoloop";
import { ApplicationErrorController } from "./controllers/application.error.controller";
import { JsonResponse } from "./middlewares/json.response";
import { Container } from "inversify";
import { AppContainer } from "./container/app.container";

export function predefinedSpec(spec: OpenAPIV3.Document): OpenAPIV3.Document {
    setOpenApi3(spec);
    loadSchemasIntoSpec(spec, "./resources/schemas.json");

    spec.info = {
        title: "Logion off-chain service API",
        description: `API for data and services managed off-chain.  
[Spec V3](/api-spec/v3)`,
        termsOfService: "https://logion.network/",
        contact: {
            name: "Logion Team",
            url: "https://logion.network/",
            email: "info@logion.network"
        },
        license: {
            name: "Apache 2.0",
            url: "http://www.apache.org/licenses/LICENSE-2.0"
        },
        version: "0.1",
    };

    fillInSpecForProtectionController(spec);
    fillInSpecForTransaction(spec);
    fillInSpecForAuthentication(spec);
    fillInSpecForLoc(spec);
    fillInSpecForHealth(spec);

    return spec;
}

export function setupApp(app: Express) {
    app.use(bodyParser.json());
    app.use(fileUpload({
        limits: { fileSize: 50 * 1024 * 1024 },
        useTempFiles : true,
        tempFileDir : '/tmp/',
    }));
    app.use(cors());

    const dino = new Dino(app, '/api');

    dino.useRouter(() => express.Router());
    dino.registerController(AuthenticationController);
    dino.registerController(ProtectionRequestController);
    dino.registerController(TransactionController);
    dino.registerController(LocRequestController);
    dino.registerController(HealthController);
    dino.registerApplicationError(ApplicationErrorController);
    dino.requestEnd(JsonResponse);

    dino.dependencyResolver<Container>(AppContainer,
        (injector, type) => {
            return injector.resolve(type);
        });

    dino.bind();
}
