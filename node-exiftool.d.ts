import { SpawnOptionsWithoutStdio } from "child_process";
import { EventEmitter } from "events";
import { Readable } from "stream";

declare module "node-exiftool" {

    export const EXIFTOOL_PATH: string;

    export const events: { OPEN: string, EXIT: string };

    export type ExifData = Record<string, string>;

    export type ReadResult = {data: (ExifData | null)[], error: string | null};

    export class ExiftoolProcess extends EventEmitter {

        constructor(bin?: string);

        async open(encoding?: string, options?: SpawnOptionsWithoutStdio): Promise<number>;

        async close(): Promise<void>;

        get isOpen(): boolean;

        async readMetadata(file: string | Readable, args: string[]): Promise<ReadResult>;

        async writeMetadata(file: string, data: ExifData, args?: string[], debug?: boolean);
    }    
}
