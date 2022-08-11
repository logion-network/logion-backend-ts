import { injectable } from 'inversify';
import { ExifData, ExiftoolProcess, ReadResult } from "node-exiftool";

@injectable()
export class ExifService {

    async readAllMetadata(file: string): Promise<Record<string, string>> {
        const exiftool = await this.openProcess();
        const result = await exiftool.readMetadata(file, ["-File:all"]);
        await exiftool.close();
        return this.getData(result, data => data, {});
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
        const exiftool = await this.openProcess();
        const result = await exiftool.readMetadata(file, ["-File:all", "Description"]);
        await exiftool.close();
        return this.getData(result, data => data.Description, undefined);
    }

    async writeImageDescription(args: { file: string, description: string }): Promise<void> {
        const exiftool = await this.openProcess();
        await exiftool.writeMetadata(args.file, { Description: args.description }, [ "overwrite_original" ]);
        await exiftool.close();
    }
}
