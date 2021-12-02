import { createLogger, format, Logger, transports as winstonTransports } from 'winston';

const transports = [
    new (winstonTransports.Console)()
]

type LogLevel = 'info' | 'debug' | 'warn' | 'error';

const LOG_LEVEL: LogLevel = "info"

export class Log {
    private static _logger: Logger | undefined;

    private static create(): Logger {
        this._logger = createLogger({
            format: format.combine(
                format.splat(),
                format.simple(),
                format.timestamp({
                    format: 'YYYY-MM-DD HH:mm:ss'
                }),
                format.printf(info => `${ info.timestamp } ${ info.level }: ${ info.message }` + (info.splat !== undefined ? `${ info.splat }` : " "))
            ),
            level: LOG_LEVEL,
            transports,
            exitOnError: false,
            exceptionHandlers: transports,
        });
        this._logger.log(LOG_LEVEL, "Log Level: %s", LOG_LEVEL)
        return this._logger;
    }

    static get logger(): Logger {
        return this._logger || this.create();
    }
}
