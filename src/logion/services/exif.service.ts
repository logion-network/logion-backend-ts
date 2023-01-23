import { injectable } from 'inversify';
import { ExifData, ExiftoolProcess, ReadWriteResult } from "@logion/node-exiftool";

const SUPPORTED_TYPES = new Set([
    "image/jpeg",
    "image/gif",
    "video/mp4",
]);

@injectable()
export class ExifService {

    async readAllMetadata(file: string): Promise<Record<string, string>> {
        const result = await this._readMetadata(file, []);
        return this.getData(result, data => data, {});
    }

    private async _readMetadata(file: string, options: string[]): Promise<ReadWriteResult> {
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

    private getData<T>(result: ReadWriteResult, getter: (result: ExifData) => T, defaultValue: T): T {
        if(result.error) {
            throw new Error(result.error);
        } else if(result.data.length > 0 && result.data[0] !== null) {
            return getter(result.data[0]);
        } else {
            return defaultValue;
        }
    }

    async readImageDescription(file: string): Promise<string | undefined> {
        const fieldName = await this.descriptionField(file);
        const result = await this._readMetadata(file, [ fieldName ]);
        return this.getData(result, data => data[fieldName], undefined);
    }

    private async descriptionField(file: string) {
        // Supported tag names per type: https://exiftool.org/TagNames/
        const mimeType = await this._readMimeType(file);
        if(mimeType === "image/jpeg" || mimeType === "video/mp4") {
            return "Description";
        } else if(mimeType === "image/gif") {
            return "Comment";
        } else {
            throw new Error(`Unsupported file type ${mimeType}`);
        }
    }

    async writeImageDescription(args: { file: string, description: string }): Promise<void> {
        const metadata: Record<string, string> = {};
        const fieldName = await this.descriptionField(args.file);
        metadata[fieldName] = args.description;

        const exiftool = await this.openProcess();
        const result = await exiftool.writeMetadata(args.file, metadata, [ "overwrite_original" ]);
        if(result.error && result.error !== "1 image files updated") {
            throw new Error(result.error);
        }
        await exiftool.close();
    }

    async isExifSupported(file: string): Promise<boolean> {
        const mimeType = await this._readMimeType(file);
        return SUPPORTED_TYPES.has(mimeType);
    }

    private async _readMimeType(file: string): Promise<string> {
        const result = await this._readMetadata(file, [ "MIMEType" ]);
        return this.getData(result, data => data.MIMEType, "");
    }
}
