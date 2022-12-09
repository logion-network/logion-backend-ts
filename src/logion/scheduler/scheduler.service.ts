import { injectable } from "inversify";
import { ToadScheduler, SimpleIntervalJob, AsyncTask } from 'toad-scheduler';
import moment from 'moment';

import { Log } from '@logion/rest-api-core';
import { BlockConsumer } from "../services/blockconsumption.service.js";

const { logger } = Log;

@injectable()
export class Scheduler {

    constructor(
        private blockConsumer: BlockConsumer
    ) {
        this.scheduler = new ToadScheduler()
    }

    private scheduler: ToadScheduler;
    private running: boolean = false;

    start() {
        logger.info("Starting scheduler...");
        const syncTransactions = async () => {
            if (!this.running) {
                this.running = true;
                try {
                    await this.blockConsumer.consumeNewBlocks(() => moment());
                } catch(e: any) {
                    logger.error(e.message);
                    logger.error(e.stack);
                } finally {
                    this.running = false;
                }
            }
        };
        const task = new AsyncTask(
            'transactions sync',
            syncTransactions,
            (err: Error) => {
                this.running = false;
                logger.error(err.message)
                logger.error(err.stack);
            }
        )
        const job = new SimpleIntervalJob({ seconds: 6 }, task);
        this.scheduler.addSimpleIntervalJob(job)
    }
}
