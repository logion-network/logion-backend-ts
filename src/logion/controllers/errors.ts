import { BadRequestException } from "dinoloop/modules/builtin/exceptions/exceptions";

export function badRequest(error: string): Error {
    return new BadRequestException({
        message: '400 Bad Request',
        errorMessage: error
    })
}
