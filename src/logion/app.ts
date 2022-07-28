// tslint:disable-next-line: no-require-imports no-var-requires
import { createConnection } from "typeorm";
import express, { Express } from 'express';
import expressOasGenerator, { SPEC_OUTPUT_FILE_BEHAVIOR } from 'express-oas-generator';
import { AppContainer } from './container/app.container';
import { Scheduler } from "./scheduler/scheduler.service";
import { Log } from "./util/Log";
import { setupApp, predefinedSpec } from "./app.support";

const { logger } = Log;

require('source-map-support').install();

const app:Express = express();

expressOasGenerator.handleResponses(app, {
    predefinedSpec,
    specOutputFileBehavior: SPEC_OUTPUT_FILE_BEHAVIOR.RECREATE,
    swaggerDocumentOptions: {

    },
    alwaysServeDocs: true,
});

createConnection()
.then(_ => {

    setupApp(app)

    AppContainer.get(Scheduler).start();

    expressOasGenerator.handleRequests();

    const port = process.env.PORT || 8080;
    app.listen(port, () => logger.info(`Server started on port ${ port }`));
});
