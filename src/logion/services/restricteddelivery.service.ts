import { injectable } from 'inversify';

import { ExifService } from './exif.service';
import { RestrictedDeliveryMetadata, RestrictedDeliveryMetadataUpdater } from './RestrictedDeliveryMetadata';

@injectable()
export class RestrictedDeliveryService {

    constructor(
        private exifService: ExifService,
    ) {}

    async setMetadata(args: { file: string, metadata: RestrictedDeliveryMetadata }): Promise<void> {
        if(await this.exifService.isExifSupported(args.file)) {
            const description = (await this.exifService.readImageDescription(args.file)) || "";
            const updater = new RestrictedDeliveryMetadataUpdater(description);
            updater.setMetadata(args.metadata);
            await this.exifService.writeImageDescription({ file: args.file, description: updater.text });
        }
    }
}
