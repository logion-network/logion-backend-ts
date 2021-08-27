import { createLogger, Logger, transports as winstonTransports } from 'winston';

const transports = [
    new (winstonTransports.Console)()
]

export class Log {
    private static _logger: Logger | undefined;

    private static create(): Logger {
        this._logger = createLogger({
            transports,
            exitOnError: false,
            exceptionHandlers: transports,
        });

        return this._logger;
    }

    static get logger(): Logger {
        return this._logger || this.create();
    }
}
