import { It, Mock, Times } from "moq.ts";

import { ExifService } from "../../../src/logion/services/exif.service.js";
import { RestrictedDeliveryMetadataWithoutSignature, RestrictedDeliveryService } from "../../../src/logion/services/restricteddelivery.service.js";
import moment from "moment";

describe("RestrictedDeliveryService", () => {

    const owner = "0xa6db31d1aee06a3ad7e4e56de3775e80d2f5ea84";
    const generatedOn = "2022-08-17T10:27:00.000Z";
    const nodeId = "12D3KooWBmAwcd4PJNJvfV89HwE48nwkRmAgo8Vy3uQEyNNHBox2";
    const signature = "478857840781bbeb2deb5b26f381723c874339afff66b0375a1a23962ef13805bea21878130a42f0f7ce8540c97b35ea856de92ebc1d3a3bdd67b30dfd030904";
    const metadata: RestrictedDeliveryMetadataWithoutSignature = {
        owner,
        generatedOn: moment(generatedOn),
    };

    beforeEach(() => {
        process.env.JWT_SECRET = "1c482e5368b84abe08e1a27d0670d303351989b3aa281cb1abfc2f48e4530b57";
        process.env.JWT_ISSUER = nodeId;
    });

    it("sets metadata with expected description if supported", async () => {
        const file = "test/resources/exif.jpg";
        const imageDescription = "Some description.";
        const exifService = new Mock<ExifService>();
        exifService.setup(instance => instance.readImageDescription(file)).returnsAsync(imageDescription);
        exifService.setup(instance => instance.writeImageDescription(It.IsAny())).returnsAsync();
        exifService.setup(instance => instance.isExifSupported(file)).returnsAsync(true);

        process.env.JWT_ISSUER = "12D3KooWBmAwcd4PJNJvfV89HwE48nwkRmAgo8Vy3uQEyNNHBox2";
        const service = new RestrictedDeliveryService(exifService.object());
        const expectedDescription = `Some description.

-----BEGIN LOGION METADATA-----
owner=${owner}
generatedOn=${generatedOn}
nodeId=${nodeId}
signature=${signature}
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

        await service.setMetadata({
            file,
            metadata,
        });

        exifService.verify(instance => instance.writeImageDescription(It.IsAny()), Times.Never());
    });
});
