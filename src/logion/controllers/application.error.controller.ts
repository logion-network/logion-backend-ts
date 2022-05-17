import { injectable } from 'inversify';
import { ErrorController } from 'dinoloop';

import { Log } from "../util/Log";

const { logger } = Log;

@injectable()
export class ApplicationErrorController extends ErrorController {
    internalServerError(): void {
        logger.error(this.error.message);
        logger.error(this.error.stack);
        this.response
            .status(500)
            .json({
                message: 'Internal server error 500!',
                errorMessage: this.error.message,
                errorStack: this.error.stack
            });
    }
}
