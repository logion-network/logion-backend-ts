import { injectable } from 'inversify';
import { copyFile } from 'fs/promises';

import { ExifService } from './exif.service';
import { RestrictedDeliveryMetadata, RestrictedDeliveryMetadataUpdater } from './RestrictedDeliveryMetadata';

@injectable()
export class RestrictedDeliveryService {

    constructor(
        private exifService: ExifService,
    ) {}

    async copyAndSetMetadata(args: { original: string, deliverable: string, metadata: RestrictedDeliveryMetadata }): Promise<void> {
        await copyFile(args.original, args.deliverable);
        const description = (await this.exifService.readImageDescription(args.original)) || "";
        const updater = new RestrictedDeliveryMetadataUpdater(description);
        updater.setMetadata(args.metadata);
        await this.exifService.writeImageDescription({ file: args.deliverable, description: updater.text });
    }
}
