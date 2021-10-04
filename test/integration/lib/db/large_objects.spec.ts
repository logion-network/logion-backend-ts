import { importFile, exportFile } from "../../../../src/logion/lib/db/large_objects";
import { readFile, rm } from 'fs/promises';

describe("Large Objects module", () => {

    it("imports and exports local file", async () => {
        const importedFile = 'test/integration/lib/db/file.txt';
        const id = await importFile(importedFile, "a short description of the file");
        expect(id).toBeInstanceOf(Number);
        const tempFile = "/tmp/logion_large_objects_test_export.txt";
        await exportFile(id, tempFile);
        const importedContent = await readFile(importedFile);
        const exportedContent = await readFile(tempFile);
        await rm(tempFile);
        expect(exportedContent).toEqual(importedContent);
    })
});
