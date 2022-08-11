import { copyFile } from 'fs/promises';
import os from "os";
import path from "path";

import { ExifService } from "../../../src/logion/services/exif.service";

describe("ExifService", () => {

    it("reads all metadata", async () => {
        const exifService = new ExifService();
        const description = await exifService.readAllMetadata("./test/resources/exif.jpg");
        expect(description.Description).toBeDefined();
    });

    it("reads image description", async () => {
        const exifService = new ExifService();
        const description = await exifService.readImageDescription("./test/resources/exif.jpg");
        expect(description).toBe("Some description.");
    });

    it("writes image description", async () => {
        const tempFile = path.join(os.tmpdir(), "exif.jpg");
        await copyFile("./test/resources/exif.jpg", tempFile);

        const exifService = new ExifService();
        const newDescription = "Some other description.";
        await exifService.writeImageDescription({
            file: tempFile,
            description: newDescription
        });
        const description = await exifService.readImageDescription(tempFile);

        expect(description).toBe(newDescription);
    });
});
