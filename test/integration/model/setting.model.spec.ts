import { TestDb } from "@logion/rest-api-core";
import { SettingRepository, SettingAggregateRoot } from "../../../src/logion/model/setting.model.js";
import { ALICE, BOB, CHARLY } from "../../helpers/addresses.js";

const { connect, disconnect, executeScript } = TestDb;

describe("LoFileRepository", () => {

    let repository: SettingRepository;

    beforeAll(async () => {
        await connect([ SettingAggregateRoot ]);
        await executeScript("test/integration/model/settings.sql");
        repository = new SettingRepository();
    });

    afterAll(async () => {
        await disconnect();
    });

    it("finds by id", async () => {
        const setting = await repository.findById({ id: "setting-1", legalOfficerAddress: ALICE });
        expect(setting?.value).toEqual("value-1");
    })

    it("finds by legal officer", async () => {
        const settings = await repository.findByLegalOfficer(ALICE);
        checkArray(settings, ["value-1", "value-2"])
    })

    it("saves a new setting", async () => {
        const setting = new SettingAggregateRoot();
        setting.id = "setting-3";
        setting.value = "value-3";
        setting.legalOfficerAddress = CHARLY;
        await repository.save(setting);

        const settings = await repository.findByLegalOfficer(CHARLY);
        checkArray(settings, ["charly-value-1", "charly-value-2", "value-3"])
    })


    it("updates an existing setting", async () => {
        const setting = new SettingAggregateRoot();
        setting.id = "setting-2";
        setting.value = "new-value-2";
        setting.legalOfficerAddress = BOB;
        await repository.save(setting);

        const settings = await repository.findByLegalOfficer(BOB);
        checkArray(settings, ["bob-value-1", "new-value-2"])
    })

    function checkArray(settings: SettingAggregateRoot[], expectedValues: string []) {
        settings.sort((a, b) => a.value!.localeCompare(b.value!));
        expect(settings.length).toEqual(expectedValues.length);
        expect(settings.map(setting => setting.value)).toEqual(expectedValues);
    }
})
