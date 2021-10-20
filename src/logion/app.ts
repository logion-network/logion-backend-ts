// tslint:disable-next-line: no-require-imports no-var-requires
import { createConnection } from "typeorm";
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import fileUpload from 'express-fileupload';
import { Container } from 'inversify';
import { Dino } from 'dinoloop';
import expressOasGenerator, { SPEC_OUTPUT_FILE_BEHAVIOR } from 'express-oas-generator';
import { OpenAPIV3 } from 'openapi-types';

import {
    ProtectionRequestController,
    fillInSpec as fillInSpecForProtectionController
} from './controllers/protectionrequest.controller';
import { AppContainer } from './container/app.container';
import { JsonResponse } from './middlewares/json.response';
import { ApplicationErrorController } from './controllers/application.error.controller';
import { setOpenApi3, loadSchemasIntoSpec } from './controllers/doc';
import {
    TokenizationRequestController,
    fillInSpec as fillInSpecForTokenization
} from './controllers/tokenizationrequest.controller';
import { TransactionController, fillInSpec as fillInSpecForTransaction } from "./controllers/transaction.controller";
import { Scheduler } from "./scheduler/scheduler.service";
import {
    AuthenticationController,
    fillInSpec as fillInSpecForAuthentication
} from "./controllers/authentication.controller";
import { LocRequestController, fillInSpec as fillInSpecForLoc } from "./controllers/locrequest.controller";

require('source-map-support').install();

const app = express();
expressOasGenerator.handleResponses(app, {
    predefinedSpec: function(spec: OpenAPIV3.Document) {
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
        fillInSpecForTokenization(spec);
        fillInSpecForTransaction(spec);
        fillInSpecForAuthentication(spec);
        fillInSpecForLoc(spec);

        return spec;
    },
    specOutputFileBehavior: SPEC_OUTPUT_FILE_BEHAVIOR.RECREATE,
    swaggerDocumentOptions: {

    },
    alwaysServeDocs: true,
});
const port = process.env.PORT || 8080;

createConnection()
.then(_ => {
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
    dino.registerController(TokenizationRequestController);
    dino.registerController(TransactionController);
    dino.registerController(LocRequestController);
    dino.registerApplicationError(ApplicationErrorController);
    dino.requestEnd(JsonResponse);

    dino.dependencyResolver<Container>(AppContainer,
        (injector, type) => {
            return injector.resolve(type);
        });

    dino.bind();

    AppContainer.get(Scheduler).start();

    expressOasGenerator.handleRequests();
    app.listen(port, () => console.log(`Server started on port ${port}`));
});
