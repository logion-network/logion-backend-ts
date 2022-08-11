import { RestrictedDeliveryMetadata, RestrictedDeliveryMetadataCodec } from "../../../src/logion/services/RestrictedDeliveryMetadata";

const owner = "0xa6db31d1aee06a3ad7e4e56de3775e80d2f5ea84";

describe("RestrictedDeliveryMetadataCodec", () => {

    it("encodes metadata", () => {
        const metadata: RestrictedDeliveryMetadata = {
            owner,
        };
        const encodedMetadata = RestrictedDeliveryMetadataCodec.encode(metadata);
        expect(encodedMetadata).toBe(`-----BEGIN LOGION METADATA-----
owner=${owner}
-----END LOGION METADATA-----`);
    });

    it("decodes metadata", () => {
        const encodedMetadata = `-----BEGIN LOGION METADATA-----
owner=${owner}
-----END LOGION METADATA-----`;
        const metadata = RestrictedDeliveryMetadataCodec.decode(encodedMetadata);
        expect(metadata.owner).toBe(owner);
    });
});
