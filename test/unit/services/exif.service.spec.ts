import { copyFile } from 'fs/promises';
import os from "os";
import path from "path";

import { ExifService } from "../../../src/logion/services/exif.service";

describe("ExifService", () => {

    const jpegFile = "./test/resources/exif.jpg";

    const jsonFile = "./test/resources/block-empty.json";

    it("reads all JPEG metadata", async () => {
        const exifService = new ExifService();
        const description = await exifService.readAllMetadata(jpegFile);
        expect(description.Description).toBeDefined();
    });

    it("reads JPEG image description", async () => {
        const exifService = new ExifService();
        const description = await exifService.readImageDescription(jpegFile);
        expect(description).toBe("Some description.");
    });

    it("writes JPEG image description", async () => {
        const tempFile = path.join(os.tmpdir(), "exif.jpg");
        await copyFile(jpegFile, tempFile);

        const exifService = new ExifService();
        const newDescription = `Some other description.

-----BEGIN LOGION METADATA-----
owner=0xa6db31d1aee06a3ad7e4e56de3775e80d2f5ea84
-----END LOGION METADATA-----
`;
        await exifService.writeImageDescription({
            file: tempFile,
            description: newDescription
        });
        const description = await exifService.readImageDescription(tempFile);

        expect(description).toBe(newDescription);
    });

    it("detects JPEG file format is supported", async () => {
        testFileSupported(jpegFile, true);
    });

    it("detects JSON file format is not supported", async () => {
        testFileSupported(jsonFile, false);
    });
});

async function testFileSupported(file: string, expected: boolean) {
    const exifService = new ExifService();
    const supported = await exifService.isExifSupported(file);
    expect(supported).toBe(expected);
}
