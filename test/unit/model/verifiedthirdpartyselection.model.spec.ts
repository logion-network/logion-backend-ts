import { VerifiedIssuerAggregateRoot, VerifiedIssuerSelectionFactory, VerifiedIssuerSelectionId } from "../../../src/logion/model/verifiedissuerselection.model.js";

describe("VerifiedIssuerSelectionFactory", () => {

    it("creates new selection for verified issuer", () => {
        const selection = buildSelection();
        expect(selection.id).toEqual(SELECTION_ID);
        expect(selection.selected).toBe(true);
        expect(selection.identityLocId).toBe(ISSUER_LOC_ID);
    });
});

function buildSelection(): VerifiedIssuerAggregateRoot {
    const factory = new VerifiedIssuerSelectionFactory();
    return factory.newSelection(SELECTION_ID, ISSUER_LOC_ID);
}

const ISSUER_ADDRESS = "5FniDvPw22DMW1TLee9N8zBjzwKXaKB2DcvZZCQU5tjmv1kb";
const SELECTION_ID: VerifiedIssuerSelectionId = {
    locRequestId: "98c54013-af47-409f-b90d-edcdb71e7cb9",
    issuer: ISSUER_ADDRESS,
};
const ISSUER_LOC_ID = "a3c29d7b-6ad5-44f6-b2df-f09dd841f212";
