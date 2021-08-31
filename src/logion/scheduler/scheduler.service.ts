import { injectable } from "inversify";
import { ToadScheduler, SimpleIntervalJob, AsyncTask } from 'toad-scheduler';
import moment from 'moment';

import { Log } from '../util/Log';
import { TransactionSync } from "../sync/transactionsync.service";

const { logger } = Log;

@injectable()
export class Scheduler {

    constructor(
        private transactionSync: TransactionSync
    ) {
        this.scheduler = new ToadScheduler()
    }

    private scheduler: ToadScheduler;

    start() {
        logger.info("Starting scheduler...");
        const syncTransactions = () => this.transactionSync.syncTransactions(moment());
        const task = new AsyncTask(
            'transactions sync', 
            syncTransactions,
            (err: Error) => { logger.error(err.message) }
        )
        const job = new SimpleIntervalJob({ seconds: 6 }, task);
        this.scheduler.addSimpleIntervalJob(job)
    }
}
