import os from "os";
import { It, Mock } from "moq.ts";
import path from "path";

import { ExifService } from "../../../src/logion/services/exif.service";
import { RestrictedDeliveryService } from "../../../src/logion/services/restricteddelivery.service";
import { RestrictedDeliveryMetadata } from "src/logion/services/RestrictedDeliveryMetadata";

describe("RestrictedDeliveryService", () => {

    it("generates deliverable with expected description", async () => {
        const original = "test/resources/exif.jpg";
        const imageDescription = "Some description.";
        const exifService = new Mock<ExifService>();
        exifService.setup(instance => instance.readImageDescription(original)).returnsAsync(imageDescription);
        exifService.setup(instance => instance.writeImageDescription(It.IsAny())).returnsAsync();

        const service = new RestrictedDeliveryService(exifService.object());

        const deliverable = path.join(os.tmpdir(), "deliverable.jpg");
        const owner = "0xa6db31d1aee06a3ad7e4e56de3775e80d2f5ea84";
        const metadata: RestrictedDeliveryMetadata = {
            owner,
        };
        const expectedDescription = `Some description.

-----BEGIN LOGION METADATA-----
owner=${owner}
-----END LOGION METADATA-----
`;
        await service.copyAndSetMetadata({
            original,
            deliverable,
            metadata,
        });
        exifService.verify(instance => instance.writeImageDescription(It.Is<{ file: string, description: string }>(args =>
            args.file === deliverable
            && args.description === expectedDescription
        )));
    });
});
