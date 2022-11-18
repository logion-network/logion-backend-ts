import { TestDb } from "@logion/rest-api-core";
import { VerifiedThirdPartyNominationAggregateRoot, VerifiedThirdPartyNominationRepository } from "../../../src/logion/model/verifiedthirdpartynomination.model";

const { connect, disconnect, checkNumOfRows, executeScript } = TestDb;

describe("VerifiedThirdPartyNominationRepository - read", () => {

    beforeAll(async () => {
        await connect([ VerifiedThirdPartyNominationAggregateRoot ]);
        await executeScript("test/integration/model/vtp_nomination.sql");
        repository = new VerifiedThirdPartyNominationRepository();
    });

    let repository: VerifiedThirdPartyNominationRepository;

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
        const nominations = await repository.findByLocRequestId("a7b80f86-1c51-4aff-ba32-d8361bb462b1");
        expect(nominations.length).toBe(2);
    });
});

describe("VerifiedThirdPartyNominationRepository - write", () => {

    beforeEach(async () => {
        await connect([ VerifiedThirdPartyNominationAggregateRoot ]);
        await executeScript("test/integration/model/vtp_nomination.sql");
        repository = new VerifiedThirdPartyNominationRepository();
    });

    let repository: VerifiedThirdPartyNominationRepository;

    afterEach(async () => {
        await disconnect();
    });

    it("deletes by ID", async () => {
        await repository.deleteById({
            locRequestId: "a7b80f86-1c51-4aff-ba32-d8361bb462b1",
            verifiedThirdPartyLocId: "a4eb8352-a032-44a6-8087-c95a40da0744",
        });
        checkNumOfRows(`SELECT * FROM vtp_nomination`, 2);
    });

    it("deletes by VTP LOC ID", async () => {
        await repository.deleteByVerifiedThirdPartyId("a4eb8352-a032-44a6-8087-c95a40da0744");
        checkNumOfRows(`SELECT * FROM vtp_nomination`, 2);
    });
});
