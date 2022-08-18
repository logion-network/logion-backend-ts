import { It, Mock, Times } from "moq.ts";

import { ExifService } from "../../../src/logion/services/exif.service";
import { RestrictedDeliveryMetadataWithoutSignature, RestrictedDeliveryService } from "../../../src/logion/services/restricteddelivery.service";
import moment from "moment";
import { NodeSignatureService } from "src/logion/services/nodesignature.service";
import { KeyObject } from "crypto";

describe("RestrictedDeliveryService", () => {

    const owner = "0xa6db31d1aee06a3ad7e4e56de3775e80d2f5ea84";
    const generatedOn = "2022-08-17T10:27:00.000Z";
    const signature = "c6c5e8dcb0f3f3ae6fcf075a55a8d8bec6936ae1b4ce557ff69880fa8366482319494c6ceb99f98d9919d7b066772fac01826476b9c1175a8cf6b83c0f5a390f";
    const metadata: RestrictedDeliveryMetadataWithoutSignature = {
        owner,
        generatedOn: moment(generatedOn),
    };

    it("sets metadata with expected description if supported", async () => {
        const file = "test/resources/exif.jpg";
        const imageDescription = "Some description.";
        const exifService = new Mock<ExifService>();
        exifService.setup(instance => instance.readImageDescription(file)).returnsAsync(imageDescription);
        exifService.setup(instance => instance.writeImageDescription(It.IsAny())).returnsAsync();
        exifService.setup(instance => instance.isExifSupported(file)).returnsAsync(true);
        const nodeSignatureService = new Mock<NodeSignatureService>();
        const privateKey = new Mock<KeyObject>();
        nodeSignatureService.setup(instance => instance.buildPrivateJsonWebKey(It.IsAny(), It.IsAny())).returns(privateKey.object());
        nodeSignatureService.setup(instance => instance.sign(It.IsAny(), privateKey.object())).returns(Buffer.from(signature, 'hex'));

        const service = new RestrictedDeliveryService(exifService.object(), nodeSignatureService.object());
        const expectedDescription = `Some description.

-----BEGIN LOGION METADATA-----
owner=${owner}
generatedOn=${generatedOn}
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
        const nodeSignatureService = new Mock<NodeSignatureService>();
        const privateKey = new Mock<KeyObject>();
        nodeSignatureService.setup(instance => instance.buildPrivateJsonWebKey(It.IsAny(), It.IsAny())).returns(privateKey.object());

        const service = new RestrictedDeliveryService(exifService.object(), nodeSignatureService.object());

        await service.setMetadata({
            file,
            metadata,
        });

        exifService.verify(instance => instance.writeImageDescription(It.IsAny()), Times.Never());
    });
});
