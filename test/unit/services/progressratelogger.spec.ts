import moment from 'moment';
import { Logger } from 'winston';
import { ProgressRateLogger } from "../../../src/logion/services/progressratelogger";

describe("ProgressRateLogger", () => {

    it("always if debug", () => {
        let current: BigInt | undefined;
        let last: BigInt | undefined;
        let rate: number | undefined;

        const logger: unknown = {
            isDebugEnabled: () => true,
            isInfoEnabled: () => false,
            debug: (...args: any[]) => {
                current = args[1];
                last = args[2];
                rate = args[3];
            }
        };

        const reference = moment();

        const progressRateLogger = new ProgressRateLogger(reference, 0n, 3n, logger as Logger, 2n);
        progressRateLogger.log(reference.clone().add(1000, "milliseconds"), 1n);
        expect(current).toBe(1n);
        expect(last).toBe(3n);
        expect(rate).toBe(1);

        progressRateLogger.log(reference.clone().add(2000, "milliseconds"), 2n);
        expect(current).toBe(2n);
        expect(last).toBe(3n);
        expect(rate).toBe(1);

        progressRateLogger.log(reference.clone().add(2500, "milliseconds"), 3n);
        expect(current).toBe(3n);
        expect(last).toBe(3n);
        expect(rate).toBe(1);
    })

    it("only once if info", () => {
        let current: BigInt | undefined;
        let last: BigInt | undefined;
        let rate: number | undefined;

        const logger: unknown = {
            isDebugEnabled: () => false,
            isInfoEnabled: () => true,
            debug: () => {},
            info: (...args: any[]) => {
                current = args[1];
                last = args[2];
                rate = args[3];
            }
        };

        const reference = moment();

        const progressRateLogger = new ProgressRateLogger(reference, 0n, 3n, logger as Logger, 2n);
        progressRateLogger.log(reference.clone().add(1000, "milliseconds"), 1n);
        expect(current).toBeUndefined();
        expect(last).toBeUndefined();
        expect(rate).toBeUndefined();

        progressRateLogger.log(reference.clone().add(2000, "milliseconds"), 2n);
        expect(current).toBe(2n);
        expect(last).toBe(3n);
        expect(rate).toBe(1);

        current = last = rate = undefined;

        progressRateLogger.log(reference.clone().add(2500, "milliseconds"), 3n);
        expect(current).toBeUndefined();
        expect(last).toBeUndefined();
        expect(rate).toBeUndefined();
    })
})
