import { Mock } from "moq.ts";
import { LocRequestAggregateRoot, LocRequestStatus, LocType } from "../../../src/logion/model/locrequest.model";
import { VerifiedThirdPartySelectionAggregateRoot, VerifiedThirdPartySelectionFactory, VerifiedThirdPartySelectionId } from "../../../src/logion/model/verifiedthirdpartyselection.model";

describe("VerifiedThirdPartySelectionFactory", () => {

    it("creates new selection for VTP", () => {
        const identityLoc = buildIdentityLoc("Identity", "CLOSED", true, VTP_ADDRESS);
        const selection = buildNomination(identityLoc);
        expect(selection.id).toEqual(SELECTION_ID);
    });

    it("fails creating selection with non-Identity LOC", () => {
        const identityLoc = buildIdentityLoc("Collection", "CLOSED", false, VTP_ADDRESS);
        expect(() => buildNomination(identityLoc)).toThrowError("VTP LOC is not an identity LOC");
    });

    it("fails creating selection with non-closed Identity LOC", () => {
        const identityLoc = buildIdentityLoc("Identity", "OPEN", false, VTP_ADDRESS);
        expect(() => buildNomination(identityLoc)).toThrowError("VTP LOC is not closed");
    });

    it("fails creating selection with non-verified Identity LOC", () => {
        const identityLoc = buildIdentityLoc("Identity", "CLOSED", false, VTP_ADDRESS);
        expect(() => buildNomination(identityLoc)).toThrowError("Party is not verified");
    });

    it("fails creating selection with non-verified Identity LOC", () => {
        const identityLoc = buildIdentityLoc("Identity", "CLOSED", false, VTP_ADDRESS);
        expect(() => buildNomination(identityLoc)).toThrowError("Party is not verified");
    });

    it("fails creating selection with requester as VTP", () => {
        const identityLoc = buildIdentityLoc("Identity", "CLOSED", true, LOC_REQUESTER);
        expect(() => buildNomination(identityLoc)).toThrowError("Cannot select LOC requester as VTP");
    });
});

function buildIdentityLoc(locType: LocType, status: LocRequestStatus, verifiedThirdParty: boolean, requester: string): Mock<LocRequestAggregateRoot> {
    const identityLoc = new Mock<LocRequestAggregateRoot>();
    identityLoc.setup(instance => instance.id).returns(SELECTION_ID.verifiedThirdPartyLocId);
    identityLoc.setup(instance => instance.locType).returns(locType);
    identityLoc.setup(instance => instance.status).returns(status);
    identityLoc.setup(instance => instance.verifiedThirdParty).returns(verifiedThirdParty);
    identityLoc.setup(instance => instance.requesterAddress).returns(requester);
    return identityLoc;
}

function buildNomination(identityLoc: Mock<LocRequestAggregateRoot>): VerifiedThirdPartySelectionAggregateRoot {
    const factory = new VerifiedThirdPartySelectionFactory();

    const locRequest = new Mock<LocRequestAggregateRoot>();
    locRequest.setup(instance => instance.id).returns(SELECTION_ID.locRequestId);
    locRequest.setup(instance => instance.requesterAddress).returns(LOC_REQUESTER);

    return factory.newSelection({
        verifiedThirdPartyLocRequest: identityLoc.object(),
        locRequest: locRequest.object(),
    })
}

const SELECTION_ID: VerifiedThirdPartySelectionId = {
    locRequestId: "98c54013-af47-409f-b90d-edcdb71e7cb9",
    verifiedThirdPartyLocId: "a3c29d7b-6ad5-44f6-b2df-f09dd841f212",
};
const VTP_ADDRESS = "5FniDvPw22DMW1TLee9N8zBjzwKXaKB2DcvZZCQU5tjmv1kb";
const LOC_REQUESTER = "5H4MvAsobfZ6bBCDyj5dsrWYLrA8HrRzaqa9p61UXtxMhSCY";
