import { Log } from "@logion/rest-api-core";
import { injectable } from "inversify";
import express from 'express';
import { collectDefaultMetrics, Gauge, register } from "prom-client";

import { SyncPointRepository, TRANSACTIONS_SYNC_POINT_NAME } from "../model/syncpoint.model.js";

const { logger } = Log;

const METRIC_NAME_PREFIX = "logion_backend_";

@injectable()
export class PrometheusService {

    constructor(
        private syncPointRepository: SyncPointRepository,
    ) {
        this.lastSynchronizedBlock = new Gauge({
            name: `${ METRIC_NAME_PREFIX }last_block_synchronized`,
            help: "Last block synchronized",
        });
    }

    private lastSynchronizedBlock: Gauge;

    setLastSynchronizedBlock(number: bigint) {
        this.lastSynchronizedBlock.set(Number(number));
    }

    async startServer() {
        const prometheus = express();
        collectDefaultMetrics({
            prefix: METRIC_NAME_PREFIX,
        });
        prometheus.get('/metrics', async (_req, res) => {
            try {
                res.set('Content-Type', register.contentType);
                res.end(await register.metrics());
            } catch (ex) {
                res.status(500).end(ex);
            }
        });
        await this.initMetrics();
        const prometheusPort = process.env.PROMETHEUS_PORT || 8081;
        prometheus.listen(prometheusPort, () => logger.info(`Prometheus server started on port ${ prometheusPort }`));
    }

    private async initMetrics() {
        const lastSyncPoint = await this.syncPointRepository.findByName(TRANSACTIONS_SYNC_POINT_NAME);
        const lastSynced = lastSyncPoint !== null ? lastSyncPoint.block!.toBlock().blockNumber : 0n;
        this.setLastSynchronizedBlock(lastSynced);
    }
}
