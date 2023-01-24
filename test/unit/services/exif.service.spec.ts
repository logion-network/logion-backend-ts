import { copyFile } from 'fs/promises';
import os from "os";
import path from "path";

import { ExifService } from "../../../src/logion/services/exif.service.js";

describe("ExifService", () => {

    const jpegFile = "./test/resources/exif.jpg";

    const jsonFile = "./test/resources/block-empty.json";

    const gifFile = "./test/resources/exif.gif";

    const mp4File = "./test/resources/exif.mp4";

    const pdfFile = "./test/resources/exif.pdf";

    it("reads all JPEG metadata", () => testReadAll(jpegFile));
    it("reads JPEG image description", () => testReadDescription(jpegFile));
    it("writes JPEG image description", () => testWriteDescription(jpegFile));
    it("detects JPEG file format is supported", () => testFileSupported(jpegFile, true));

    it("detects JSON file format is not supported", () => testFileSupported(jsonFile, false));

    it("reads all GIF metadata", () => testReadAll(gifFile));
    it("reads GIF image description", () => testReadDescription(gifFile));
    it("writes GIF image description", () => testWriteDescription(gifFile));
    it("detects GIF file format is supported", () => testFileSupported(gifFile, true));

    it("reads all MP4 metadata", () => testReadAll(mp4File));
    it("reads MP4 image description", () => testReadDescription(mp4File));
    it("writes MP4 image description", () => testWriteDescription(mp4File));
    it("detects MP4 file format is supported", () => testFileSupported(mp4File, true));

    it("reads all PDF metadata", () => testReadAll(pdfFile));
    it("reads PDF image description", () => testReadDescription(pdfFile));
    it("writes PDF image description", () => testWriteDescription(pdfFile));
    it("detects PDF file format is supported", () => testFileSupported(pdfFile, true));
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
