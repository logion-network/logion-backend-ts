import { LoFileRepository, LoFileAggregateRoot, LoFileDescription } from "../../../src/logion/model/lofile.model";
import { TestDb } from "@logion/rest-api-core";
import { ALICE } from "../../helpers/addresses";
import { LegalOfficerSettingId } from "../../../src/logion/model/legalofficer.model";

const { connect, disconnect, checkNumOfRows, executeScript } = TestDb;

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
        const params: LegalOfficerSettingId = { id: "sof-header", legalOfficerAddress: ALICE };
        const loFile = await repository.findById(params);
        check(loFile, { ...params, contentType: "image/png", oid: 123 });
    })

    it("updates an existing file", async () => {
        const params: LegalOfficerSettingId = { id: "sof-oath", legalOfficerAddress: ALICE };
        const loFile = await repository.findById(params);
        check(loFile, { ...params, contentType: "image/jpeg", oid: 456 });

        const updated = new LoFileAggregateRoot()
        updated.id = loFile?.id;
        updated.legalOfficerAddress = loFile?.legalOfficerAddress;
        updated.contentType = "application/pdf";
        updated.oid = 789;

        await repository.save(updated)

        const fetched = await repository.findById(params);
        check(fetched, { ...params, contentType: "application/pdf", oid: 789 });

        await checkNumOfRows("SELECT * FROM lo_file", 4);
    })

    function check(loFile: LoFileAggregateRoot | null, description: LoFileDescription) {
        const { id, legalOfficerAddress, contentType, oid } = description;
        expect(loFile?.id).toEqual(id)
        expect(loFile?.legalOfficerAddress).toEqual(legalOfficerAddress)
        expect(loFile?.contentType).toEqual(contentType)
        expect(loFile?.oid).toEqual(oid)
    }
})
