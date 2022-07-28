import { LoFileRepository, LoFileAggregateRoot } from "../../../src/logion/model/lofile.model";
import { connect, executeScript, disconnect, checkNumOfRows } from "../../helpers/testdb";

describe("LoFileRepository", () => {

    let repository: LoFileRepository;

    beforeAll(async () => {
        await connect([ LoFileAggregateRoot ]);
        await executeScript("test/integration/model/lo_files.sql");
        repository = new LoFileRepository();
    });

    afterAll(async () => {
        await disconnect();
    });


    it("finds a file", async () => {
        const loFile = await repository.findById("sof-header");
        check(loFile, "sof-header", "image/png",123);
    })

    it("updates an existing file", async () => {
        const loFile = await repository.findById("sof-oath");
        check(loFile, "sof-oath", "image/jpeg",456);

        const updated = new LoFileAggregateRoot()
        updated.id = loFile?.id
        updated.contentType = "application/pdf";
        updated.oid = 789

        await repository.save(updated)

        const fetched = await repository.findById("sof-oath");
        check(fetched, "sof-oath", "application/pdf",789);

        await checkNumOfRows("SELECT * FROM lo_file", 2);
    })

    function check(loFile: LoFileAggregateRoot | undefined, id: string, contentType: string, oid: number) {
        expect(loFile?.id).toEqual(id)
        expect(loFile?.contentType).toEqual(contentType)
        expect(loFile?.oid).toEqual(oid)
    }
})
