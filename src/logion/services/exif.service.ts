import { injectable } from 'inversify';
import { ExifData, ExiftoolProcess, ReadResult } from "node-exiftool";

@injectable()
export class ExifService {

    async readAllMetadata(file: string): Promise<Record<string, string>> {
        const result = await this._readMetadata(file, [ "-File:all" ]);
        return this.getData(result, data => data, {});
    }

    private async _readMetadata(file: string, options: string[]): Promise<ReadResult> {
        const exiftool = await this.openProcess();
        const result = await exiftool.readMetadata(file, options);
        await exiftool.close();
        return result;
    }

    private async openProcess(): Promise<ExiftoolProcess> {
        const exiftool = new ExiftoolProcess();
        await exiftool.open();
        return exiftool;
    }

    private getData<T>(result: ReadResult, getter: (result: ExifData) => T, defaultValue: T): T {
        if(result.error) {
            throw new Error(result.error);
        } else if(result.data.length > 0 && result.data[0] !== null) {
            return getter(result.data[0]);
        } else {
            return defaultValue;
        }
    }

    async readImageDescription(file: string): Promise<string | undefined> {
        const result = await this._readMetadata(file, [ "Description" ]);
        return this.getData(result, data => data.Description, undefined);
    }

    async writeImageDescription(args: { file: string, description: string }): Promise<void> {
        const exiftool = await this.openProcess();
        await exiftool.writeMetadata(args.file, { Description: args.description }, [ "overwrite_original" ]);
        await exiftool.close();
    }

    async isExifSupported(file: string): Promise<boolean> {
        const mimeType = await this._readMimeType(file);
        return mimeType === "image/jpeg";
    }

    private async _readMimeType(file: string): Promise<string> {
        const result = await this._readMetadata(file, [ "MIMEType" ]);
        return this.getData(result, data => data.MIMEType, "");
    }
}
