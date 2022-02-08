import { Moment } from 'moment';
import { Logger } from 'winston';

export class ProgressRateLogger {

    constructor(now: Moment, current: bigint, last: bigint, logger: Logger, logRate: bigint) {
        this.startTime = now;
        this.current = current;
        this.last = last;
        this.logger = logger;
        this.logRate = logRate;
    }

    private startTime: Moment;

    private current: bigint;

    private last: bigint;

    private logger: Logger;

    private logRate: bigint;

    log(now: Moment, newCurrent: bigint) {
        if(now > this.startTime && this.shouldLog(newCurrent)) {
            const rate = this.processingRate(now.valueOf() - this.startTime.valueOf(), newCurrent - this.current);
            if(this.logger.isDebugEnabled()) {
                this.logger.debug("Scanning block %d/%d (%d bps)", newCurrent, this.last, rate);
            } else {
                this.logger.info("Scanning block %d/%d (%d bps)", newCurrent, this.last, rate);
            }
        }
    }

    private shouldLog(newCurrent: bigint): boolean {
        return this.logger.isDebugEnabled() || this.logger.isInfoEnabled() && (newCurrent % this.logRate) === 0n;
    }

    private processingRate(time: number, blocks: bigint): number {
        return Number((blocks  * 1000n / BigInt(time)));
    }
}
