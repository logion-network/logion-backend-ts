import { appDataSource, Log } from "@logion/rest-api-core";
import express from 'express';
import expressOasGenerator, { SPEC_OUTPUT_FILE_BEHAVIOR } from 'express-oas-generator';

import { AppContainer } from './container/app.container';
import { Scheduler } from "./scheduler/scheduler.service";
import { setupApp, predefinedSpec } from "./app.support";
import { PrometheusService } from "./services/prometheus.service";

const { logger } = Log;

require('source-map-support').install();

const app = express();

expressOasGenerator.handleResponses(app, {
    predefinedSpec,
    specOutputFileBehavior: SPEC_OUTPUT_FILE_BEHAVIOR.RECREATE,
    swaggerDocumentOptions: {

    },
    alwaysServeDocs: true,
});

appDataSource.initialize()
.then(() => {

    setupApp(app)

    AppContainer.get(Scheduler).start();

    expressOasGenerator.handleRequests();

    const port = process.env.PORT || 8080;
    app.listen(port, () => logger.info(`API server started on port ${ port }`));

    AppContainer.get(PrometheusService).startServer();
});
