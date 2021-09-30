import { importFile } from "../../../../src/logion/lib/db/large_objects";

describe("Large Objects module", () => {

    it("imports local file", async () => {
        const id = await importFile('test/integration/lib/db/file.txt', "a short description of the file");
        expect(id).toBeInstanceOf(Number);
    })
});
