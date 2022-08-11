import { It, Mock, Times } from "moq.ts";

import { ExifService } from "../../../src/logion/services/exif.service";
import { RestrictedDeliveryService } from "../../../src/logion/services/restricteddelivery.service";
import { RestrictedDeliveryMetadata } from "src/logion/services/RestrictedDeliveryMetadata";

describe("RestrictedDeliveryService", () => {

    it("sets metadata with expected description if supported", async () => {
        const file = "test/resources/exif.jpg";
        const imageDescription = "Some description.";
        const exifService = new Mock<ExifService>();
        exifService.setup(instance => instance.readImageDescription(file)).returnsAsync(imageDescription);
        exifService.setup(instance => instance.writeImageDescription(It.IsAny())).returnsAsync();
        exifService.setup(instance => instance.isExifSupported(file)).returnsAsync(true);

        const service = new RestrictedDeliveryService(exifService.object());

        const owner = "0xa6db31d1aee06a3ad7e4e56de3775e80d2f5ea84";
        const metadata: RestrictedDeliveryMetadata = {
            owner,
        };
        const expectedDescription = `Some description.

-----BEGIN LOGION METADATA-----
owner=${owner}
-----END LOGION METADATA-----
`;
        await service.setMetadata({
            file,
            metadata,
        });
        exifService.verify(instance => instance.writeImageDescription(It.Is<{ file: string, description: string }>(args =>
            args.file === file
            && args.description === expectedDescription
        )));
    });

    it("does not set metadata if not supported", async () => {
        const file = "test/resources/block-empty.json";
        const exifService = new Mock<ExifService>();
        exifService.setup(instance => instance.isExifSupported(file)).returnsAsync(false);

        const service = new RestrictedDeliveryService(exifService.object());

        const owner = "0xa6db31d1aee06a3ad7e4e56de3775e80d2f5ea84";
        const metadata: RestrictedDeliveryMetadata = {
            owner,
        };
        const expectedDescription = `Some description.

-----BEGIN LOGION METADATA-----
owner=${owner}
-----END LOGION METADATA-----
`;
        await service.setMetadata({
            file,
            metadata,
        });

        exifService.verify(instance => instance.writeImageDescription(It.IsAny()), Times.Never());
    });
});
