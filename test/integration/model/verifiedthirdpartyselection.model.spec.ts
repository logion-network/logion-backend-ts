import { TestDb } from "@logion/rest-api-core";
import { VerifiedThirdPartySelectionAggregateRoot, VerifiedThirdPartySelectionRepository } from "../../../src/logion/model/verifiedthirdpartyselection.model";

const { connect, disconnect, checkNumOfRows, executeScript } = TestDb;

describe("VerifiedThirdPartySelectionRepository - read", () => {

    beforeAll(async () => {
        await connect([ VerifiedThirdPartySelectionAggregateRoot ]);
        await executeScript("test/integration/model/vtp_selection.sql");
        repository = new VerifiedThirdPartySelectionRepository();
    });

    let repository: VerifiedThirdPartySelectionRepository;

    afterAll(async () => {
        await disconnect();
    });

    it("finds by ID", async () => {
        const nomination = await repository.findById({
            locRequestId: "a7b80f86-1c51-4aff-ba32-d8361bb462b1",
            verifiedThirdPartyLocId: "a4eb8352-a032-44a6-8087-c95a40da0744",
        });
        expect(nomination).toBeDefined();
    });

    it("finds by LOC requets ID", async () => {
        const nominations = await repository.findBy({ locRequestId: "a7b80f86-1c51-4aff-ba32-d8361bb462b1" });
        expect(nominations.length).toBe(2);
    });

    it("finds by VTP LOC ID", async () => {
        const nominations = await repository.findBy({ verifiedThirdPartyLocId: "a4eb8352-a032-44a6-8087-c95a40da0744" });
        expect(nominations.length).toBe(1);
    });

    it("finds selected only", async () => {
        const nominations = await repository.findBy({
            verifiedThirdPartyLocId: "f2b114f4-1196-4027-9972-e6741f868f0c",
            selected: true,
        });
        expect(nominations.length).toBe(1);
    });
});

describe("VerifiedThirdPartySelectionRepository - write", () => {

    beforeEach(async () => {
        await connect([ VerifiedThirdPartySelectionAggregateRoot ]);
        await executeScript("test/integration/model/vtp_selection.sql");
        repository = new VerifiedThirdPartySelectionRepository();
    });

    let repository: VerifiedThirdPartySelectionRepository;

    afterEach(async () => {
        await disconnect();
    });

    it("unselects by VTP LOC ID", async () => {
        await repository.unselectAll("a4eb8352-a032-44a6-8087-c95a40da0744");
        checkNumOfRows(`SELECT * FROM vtp_selection WHERE vtp_loc_id = 'a4eb8352-a032-44a6-8087-c95a40da0744' AND selected IS TRUE`, 0);
    });
});
