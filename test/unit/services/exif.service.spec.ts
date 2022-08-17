import { copyFile } from 'fs/promises';
import os from "os";
import path from "path";

import { ExifService } from "../../../src/logion/services/exif.service";

describe("ExifService", () => {

    const jpegFile = "./test/resources/exif.jpg";

    const jsonFile = "./test/resources/block-empty.json";

    const gifFile = "./test/resources/exif.gif";

    it("reads all JPEG metadata", async () => {
        await testReadAll(jpegFile);
    });

    it("reads JPEG image description", async () => {
        await testReadDescription(jpegFile);
    });

    it("writes JPEG image description", async () => {
        await testWriteDescription(jpegFile);
    });

    it("detects JPEG file format is supported", async () => {
        await testFileSupported(jpegFile, true);
    });

    it("detects JSON file format is not supported", async () => {
        await testFileSupported(jsonFile, false);
    });

    it("reads all GIF metadata", async () => {
        await testReadAll(gifFile);
    });

    it("reads GIF image description", async () => {
        await testReadDescription(gifFile);
    });

    it("writes GIF image description", async () => {
        await testWriteDescription(gifFile);
    });

    it("detects GIF file format is supported", async () => {
        await testFileSupported(gifFile, true);
    });
});

async function testReadAll(path: string) {
    const exifService = new ExifService();
    const description = await exifService.readAllMetadata(path);
    expect(description.MIMEType).toBeDefined();
}

async function testReadDescription(path: string) {
    const exifService = new ExifService();
    const description = await exifService.readImageDescription(path);
    expect(description).toBe("Some description.");
}

async function testWriteDescription(relativePath: string) {
    const tempFile = path.join(os.tmpdir(), path.basename(relativePath));
    await copyFile(relativePath, tempFile);

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
}

async function testFileSupported(file: string, expected: boolean) {
    const exifService = new ExifService();
    const supported = await exifService.isExifSupported(file);
    expect(supported).toBe(expected);
}
