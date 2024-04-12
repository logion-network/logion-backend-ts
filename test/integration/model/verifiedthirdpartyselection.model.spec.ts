import { TestDb } from "@logion/rest-api-core";
import { VerifiedIssuerAggregateRoot, VerifiedIssuerSelectionRepository } from "../../../src/logion/model/verifiedissuerselection.model.js";
import { ValidAccountId } from "@logion/node-api";

const { connect, disconnect, checkNumOfRows, executeScript } = TestDb;

describe("VerifiedIssuerSelectionRepository - read", () => {

    beforeAll(async () => {
        await connect([ VerifiedIssuerAggregateRoot ]);
        await executeScript("test/integration/model/issuer_selection.sql");
        repository = new VerifiedIssuerSelectionRepository();
    });

    let repository: VerifiedIssuerSelectionRepository;

    afterAll(async () => {
        await disconnect();
    });

    it("finds by ID", async () => {
        const nomination = await repository.findById({
            locRequestId: "a7b80f86-1c51-4aff-ba32-d8361bb462b1",
            issuer: ValidAccountId.polkadot("5EBxoSssqNo23FvsDeUxjyQScnfEiGxJaNwuwqBH2Twe35BX"),
        });
        expect(nomination).toBeDefined();
    });

    it("finds by LOC requets ID", async () => {
        const nominations = await repository.findBy({ locRequestId: "a7b80f86-1c51-4aff-ba32-d8361bb462b1" });
        expect(nominations.length).toBe(2);
    });

    it("finds by issuer address", async () => {
        const nominations = await repository.findBy({ issuer: ValidAccountId.polkadot("5EBxoSssqNo23FvsDeUxjyQScnfEiGxJaNwuwqBH2Twe35BX") });
        expect(nominations.length).toBe(1);
    });

    it("finds selected only", async () => {
        const nominations = await repository.findBy({
            issuer: ValidAccountId.polkadot("5FniDvPw22DMW1TLee9N8zBjzwKXaKB2DcvZZCQU5tjmv1kb"),
            selected: true,
        });
        expect(nominations.length).toBe(1);
    });
});

describe("VerifiedIssuerSelectionRepository - write", () => {

    beforeEach(async () => {
        await connect([ VerifiedIssuerAggregateRoot ]);
        await executeScript("test/integration/model/issuer_selection.sql");
        repository = new VerifiedIssuerSelectionRepository();
    });

    let repository: VerifiedIssuerSelectionRepository;

    afterEach(async () => {
        await disconnect();
    });

    it("unselects by issuer LOC ID", async () => {
        await repository.unselectAll("5EBxoSssqNo23FvsDeUxjyQScnfEiGxJaNwuwqBH2Twe35BX");
        checkNumOfRows(`SELECT * FROM issuer_selection WHERE issuer = '5EBxoSssqNo23FvsDeUxjyQScnfEiGxJaNwuwqBH2Twe35BX' AND selected IS TRUE`, 0);
    });
});
