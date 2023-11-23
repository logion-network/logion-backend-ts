import { Log, badRequest } from "@logion/rest-api-core";
import { Response } from "express";
import { rmSync } from "fs";
import { isNativeError } from "util/types";

const { logger } = Log;

export function downloadAndClean(args: {
    response: Response,
    path: string,
    name: string,
    contentType: string
}) {
    const { response, path, name, contentType } = args;
    response.download(path, name, {headers: { "content-type": contentType } }, (error: unknown) => {
        rmSync(path);
        if(error) {
            logger.error("Download failed: %s", error);
        }
    });
}

export function toBadRequest(e: unknown) {
    if(isNativeError(e)) {
        return badRequest(e.message);
    } else {
        return e;
    }
}
