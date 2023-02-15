import { VerifiedThirdPartySelectionAggregateRoot, VerifiedThirdPartySelectionFactory, VerifiedThirdPartySelectionId } from "../../../src/logion/model/verifiedthirdpartyselection.model.js";

describe("VerifiedThirdPartySelectionFactory", () => {

    it("creates new selection for VTP", () => {
        const selection = buildSelection();
        expect(selection.id).toEqual(SELECTION_ID);
        expect(selection.selected).toBe(true);
        expect(selection.identityLocId).toBe(VTP_LOC_ID);
    });
});

function buildSelection(): VerifiedThirdPartySelectionAggregateRoot {
    const factory = new VerifiedThirdPartySelectionFactory();
    return factory.newSelection(SELECTION_ID, VTP_LOC_ID);
}

const VTP_ADDRESS = "5FniDvPw22DMW1TLee9N8zBjzwKXaKB2DcvZZCQU5tjmv1kb";
const SELECTION_ID: VerifiedThirdPartySelectionId = {
    locRequestId: "98c54013-af47-409f-b90d-edcdb71e7cb9",
    issuer: VTP_ADDRESS,
};
const VTP_LOC_ID = "a3c29d7b-6ad5-44f6-b2df-f09dd841f212";
