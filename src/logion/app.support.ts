import { OpenAPIV3 } from "openapi-types";
import {
    fillInSpec as fillInSpecForProtectionController,
    ProtectionRequestController
} from "./controllers/protectionrequest.controller";
import { fillInSpec as fillInSpecForTransaction, TransactionController } from "./controllers/transaction.controller";
import { configureOpenApi, configureDinoloop, setOpenApi3, loadSchemasIntoSpec } from "@logion/rest-api-core";
import { fillInSpec as fillInSpecForLoc, LocRequestController } from "./controllers/locrequest.controller";
import { fillInSpec as fillInSpecForHealth, HealthController } from "./controllers/health.controller";
import express, { Express } from "express";
import bodyParser from "body-parser";
import fileUpload from "express-fileupload";
import cors from "cors";
import { Dino } from "dinoloop";
import { Container } from "inversify";
import { AppContainer } from "./container/app.container";
import { fillInSpec as fillInSpecForCollection, CollectionController } from "./controllers/collection.controller";
import { fillInSpec as fillInSpecForVaultTransferRequest, VaultTransferRequestController } from "./controllers/vaulttransferrequest.controller";
import { fillInSpec as fillInSpecForLoFile, LoFileController } from "./controllers/lofile.controller";
import { SettingController } from "./controllers/setting.controller";

export function predefinedSpec(spec: OpenAPIV3.Document): OpenAPIV3.Document {
    setOpenApi3(spec);
    loadSchemasIntoSpec(spec, "./resources/schemas.json");
    configureOpenApi(spec);

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
    fillInSpecForLoc(spec);
    fillInSpecForHealth(spec);
    fillInSpecForCollection(spec);
    fillInSpecForLoFile(spec);
    fillInSpecForVaultTransferRequest(spec);

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
    configureDinoloop(dino);

    dino.registerController(ProtectionRequestController);
    dino.registerController(TransactionController);
    dino.registerController(LocRequestController);
    dino.registerController(HealthController);
    dino.registerController(CollectionController);
    dino.registerController(VaultTransferRequestController);
    dino.registerController(LoFileController);
    dino.registerController(SettingController);

    dino.dependencyResolver<Container>(AppContainer,
        (injector, type) => {
            return injector.resolve(type);
        });

    dino.bind();
}
