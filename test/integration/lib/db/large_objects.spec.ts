import { importFile, exportFile, deleteFile } from "../../../../src/logion/lib/db/large_objects.js";
import { readFile, rm } from 'fs/promises';

describe("Large Objects module", () => {

    it("imports, exports and deletes local file", async () => {
        const importedFile = 'test/integration/lib/db/file.txt';
        const id = await importFile(importedFile, "a short description of the file");
        expect(id).toBeInstanceOf(Number);
        const tempFile = "/tmp/logion_large_objects_test_export.txt";
        await exportFile(id, tempFile);
        const importedContent = await readFile(importedFile);
        const exportedContent = await readFile(tempFile);
        await rm(tempFile);
        expect(exportedContent).toEqual(importedContent);
        await deleteFile(id);
    })
});
