import { injectable } from "inversify";
import { ToadScheduler, SimpleIntervalJob, AsyncTask } from 'toad-scheduler';
import moment from 'moment';

import { Log } from '../util/Log';
import { BlockConsumer } from "../services/blockconsumption.service";

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
        const syncTransactions = () => {
            if (!this.running) {
                this.running = true;
                return this.blockConsumer.consumeNewBlocks(moment())
                    .finally(() => {
                        this.running = false;
                        return Promise.resolve();
                    });
            } else {
                return Promise.resolve();
            }
        };
        const task = new AsyncTask(
            'transactions sync',
            syncTransactions,
            (err: Error) => {
                this.running = false;
                logger.error(err.message)
            }
        )
        const job = new SimpleIntervalJob({ seconds: 6 }, task);
        this.scheduler.addSimpleIntervalJob(job)
    }
}
