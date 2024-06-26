import { LoFileRepository, LoFileAggregateRoot, LoFileDescription } from "../../../src/logion/model/lofile.model.js";
import { TestDb } from "@logion/rest-api-core";
import { ALICE_ACCOUNT } from "../../helpers/addresses.js";
import { LegalOfficerSettingId } from "../../../src/logion/model/legalofficer.model.js";
import { DB_SS58_PREFIX } from "../../../src/logion/model/supportedaccountid.model.js";

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
        const params: LegalOfficerSettingId = { id: "sof-header", legalOfficer: ALICE_ACCOUNT };
        const loFile = await repository.findById(params);
        check(loFile, { ...params, contentType: "image/png", oid: 123 });
    })

    it("updates an existing file", async () => {
        const params: LegalOfficerSettingId = { id: "sof-oath", legalOfficer: ALICE_ACCOUNT };
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
        const { id, legalOfficer, contentType, oid } = description;
        expect(loFile?.id).toEqual(id)
        expect(loFile?.legalOfficerAddress).toEqual(legalOfficer.getAddress(DB_SS58_PREFIX))
        expect(loFile?.contentType).toEqual(contentType)
        expect(loFile?.oid).toEqual(oid)
    }
})
