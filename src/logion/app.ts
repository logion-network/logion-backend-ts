import { appDataSource, Log } from "@logion/rest-api-core";

import { AppContainer } from './container/app.container.js';
import { Scheduler } from "./scheduler/scheduler.service.js";
import { setupApp } from "./app.support.js";
import { PrometheusService } from "./services/prometheus.service.js";
import { install } from "source-map-support";

const { logger } = Log;

install();

appDataSource.initialize()
.then(() => {
    const app = setupApp({ uploadLimitMb: Number(process.env.UPLOAD_LIMIT || 300) });
    AppContainer.get(Scheduler).start();
    const port = process.env.PORT || 8080;
    app.listen(port, () => logger.info(`API server started on port ${ port }`));

    AppContainer.get(PrometheusService).startServer();
});
