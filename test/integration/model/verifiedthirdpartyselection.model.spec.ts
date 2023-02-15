import { TestDb } from "@logion/rest-api-core";
import { VerifiedThirdPartySelectionAggregateRoot, VerifiedThirdPartySelectionRepository } from "../../../src/logion/model/verifiedthirdpartyselection.model.js";

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
            issuer: "5EBxoSssqNo23FvsDeUxjyQScnfEiGxJaNwuwqBH2Twe35BX",
        });
        expect(nomination).toBeDefined();
    });

    it("finds by LOC requets ID", async () => {
        const nominations = await repository.findBy({ locRequestId: "a7b80f86-1c51-4aff-ba32-d8361bb462b1" });
        expect(nominations.length).toBe(2);
    });

    it("finds by VTP address", async () => {
        const nominations = await repository.findBy({ issuer: "5EBxoSssqNo23FvsDeUxjyQScnfEiGxJaNwuwqBH2Twe35BX" });
        expect(nominations.length).toBe(1);
    });

    it("finds selected only", async () => {
        const nominations = await repository.findBy({
            issuer: "5FniDvPw22DMW1TLee9N8zBjzwKXaKB2DcvZZCQU5tjmv1kb",
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
        await repository.unselectAll("5EBxoSssqNo23FvsDeUxjyQScnfEiGxJaNwuwqBH2Twe35BX");
        checkNumOfRows(`SELECT * FROM vtp_selection WHERE issuer = '5EBxoSssqNo23FvsDeUxjyQScnfEiGxJaNwuwqBH2Twe35BX' AND selected IS TRUE`, 0);
    });
});
