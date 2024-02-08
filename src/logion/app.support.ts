import { OpenAPIV3 } from "openapi-types";
import expressOasGenerator, { SPEC_OUTPUT_FILE_BEHAVIOR } from 'express-oas-generator';
import {
    fillInSpec as fillInSpecForProtectionController,
    ProtectionRequestController
} from "./controllers/protectionrequest.controller.js";
import { fillInSpec as fillInSpecForTransaction, TransactionController } from "./controllers/transaction.controller.js";
import { configureOpenApi, configureDinoloop, setOpenApi3, loadSchemasIntoSpec, Log } from "@logion/rest-api-core";
import { fillInSpec as fillInSpecForLoc, LocRequestController } from "./controllers/locrequest.controller.js";
import express, { Express } from "express";
import bodyParser from "body-parser";
import fileUpload from "express-fileupload";
import cors from "cors";
import { Dino } from "dinoloop";
import { Container } from "inversify";
import { AppContainer } from "./container/app.container.js";
import { fillInSpec as fillInSpecForCollection, CollectionController } from "./controllers/collection.controller.js";
import { fillInSpec as fillInSpecForVaultTransferRequest, VaultTransferRequestController } from "./controllers/vaulttransferrequest.controller.js";
import { fillInSpec as fillInSpecForLoFile, LoFileController } from "./controllers/lofile.controller.js";
import { fillInSpec as fillInSpecForSettings, SettingController } from "./controllers/setting.controller.js";
import { fillInSpec as fillInSpecVerifiedIssuer, VerifiedIssuerController } from "./controllers/verifiedissuer.controller.js";
import { fillInSpec as fillInSpecConfig, ConfigController } from "./controllers/config.controller.js";
import { fillInSpec as fillInSpecIdenfy, IdenfyController } from "./controllers/idenfy.controller.js";
import { fillInSpec as fillInSpecVote, VoteController } from "./controllers/vote.controller.js";
import { fillInSpec as fillInSpecTokensRecord, TokensRecordController } from "./controllers/records.controller.js";
import { fillInSpec as fillInSpecWorkload, WorkloadController } from "./controllers/workload.controller.js";

const { logger } = Log;

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
    fillInSpecForCollection(spec);
    fillInSpecForLoFile(spec);
    fillInSpecForSettings(spec);
    fillInSpecForVaultTransferRequest(spec);
    fillInSpecVerifiedIssuer(spec);
    fillInSpecConfig(spec);
    fillInSpecIdenfy(spec);
    fillInSpecVote(spec);
    fillInSpecTokensRecord(spec);
    fillInSpecWorkload(spec);

    return spec;
}

export interface ExpressConfig {
    withDoc?: boolean;
    uploadLimitMb?: number;
}

export function buildExpress(expressConfig?: ExpressConfig): Express {
    const { withDoc, uploadLimitMb } = expressConfig || {};

    const app = express();

    if(withDoc === undefined || withDoc) {
        expressOasGenerator.handleResponses(app, {
            predefinedSpec,
            specOutputFileBehavior: SPEC_OUTPUT_FILE_BEHAVIOR.RECREATE,
            swaggerDocumentOptions: {
        
            },
            alwaysServeDocs: true,
        });
    }

    app.use(bodyParser.json({
        verify: (req, _res, buf) => {
            (req as any).rawBody = buf; // eslint-disable-line @typescript-eslint/no-explicit-any
        }
    }));
    app.use(bodyParser.urlencoded({ extended: false }));
    const actualUploadLimitMb = uploadLimitMb || 300;
    logger.info(`Upload limit set to ${ actualUploadLimitMb }M`);
    app.use(fileUpload({
        limits: { fileSize: actualUploadLimitMb * 1024 * 1024 },
        useTempFiles : true,
        tempFileDir : '/tmp/',
    }));
    app.use(cors());
    return app;
}

export function setupApp(expressConfig?: ExpressConfig): Express {
    const app = buildExpress(expressConfig);
    const dino = new Dino(app, '/api');

    dino.useRouter(() => express.Router());
    configureDinoloop(dino);

    dino.registerController(ProtectionRequestController);
    dino.registerController(TransactionController);
    dino.registerController(LocRequestController);
    dino.registerController(CollectionController);
    dino.registerController(VaultTransferRequestController);
    dino.registerController(LoFileController);
    dino.registerController(SettingController);
    dino.registerController(VerifiedIssuerController);
    dino.registerController(ConfigController);
    dino.registerController(IdenfyController);
    dino.registerController(VoteController);
    dino.registerController(TokensRecordController);
    dino.registerController(WorkloadController);

    dino.dependencyResolver<Container>(AppContainer,
        (injector, type) => {
            return injector.resolve(type);
        });

    dino.bind();

    if(expressConfig?.withDoc === undefined || expressConfig.withDoc) {
        expressOasGenerator.handleRequests();
    }
    return app;
}
