import { BadRequestException } from "dinoloop/modules/builtin/exceptions/exceptions";

export function badRequest(error: string): Error {
    return new BadRequestException(errorPayload(
        '400 Bad Request',
        error
    ));
}

export interface ErrorPayload {
    message: string;
    errorMessage: string;
    errorStack?: string;
}

export function errorPayload(httpError: string, errorMessage: string, errorStack?: string): ErrorPayload {
    return {
        message: httpError,
        errorMessage,
        errorStack,
    };
}

export function forbidden(error: string): Error {
    return new BadRequestException(errorPayload(
        '403 Forbidden',
        error
    ));
}
