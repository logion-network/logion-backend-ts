import { Log } from "@logion/rest-api-core";
import { Response } from "express";
import { rmSync } from "fs";

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
