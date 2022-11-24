import { Mock } from "moq.ts";
import { LocRequestAggregateRoot, LocRequestStatus, LocType } from "../../../src/logion/model/locrequest.model";
import { VerifiedThirdPartySelectionAggregateRoot, VerifiedThirdPartySelectionFactory, VerifiedThirdPartySelectionId } from "../../../src/logion/model/verifiedthirdpartyselection.model";

describe("VerifiedThirdPartySelectionFactory", () => {

    it("creates new nomination for VTP", () => {
        const identityLoc = buildIdentityLoc("Identity", "CLOSED", true);
        const nomination = buildNomination(identityLoc);
        expect(nomination.id).toEqual(SELECTION_ID);
    });

    it("fails creating nomination with non-Identity LOC", () => {
        const identityLoc = buildIdentityLoc("Collection", "CLOSED", false);
        expect(() => buildNomination(identityLoc)).toThrowError("VTP LOC is not an identity LOC");
    });

    it("fails creating nomination with non-closed Identity LOC", () => {
        const identityLoc = buildIdentityLoc("Identity", "OPEN", false);
        expect(() => buildNomination(identityLoc)).toThrowError("VTP LOC is not closed");
    });

    it("fails creating nomination with non-verified Identity LOC", () => {
        const identityLoc = buildIdentityLoc("Identity", "CLOSED", false);
        expect(() => buildNomination(identityLoc)).toThrowError("Party is not verified");
    });
});

function buildIdentityLoc(locType: LocType, status: LocRequestStatus, verifiedThirdParty: boolean): Mock<LocRequestAggregateRoot> {
    const identityLoc = new Mock<LocRequestAggregateRoot>();
    identityLoc.setup(instance => instance.id).returns(SELECTION_ID.verifiedThirdPartyLocId);
    identityLoc.setup(instance => instance.locType).returns(locType);
    identityLoc.setup(instance => instance.status).returns(status);
    identityLoc.setup(instance => instance.verifiedThirdParty).returns(verifiedThirdParty);
    return identityLoc;
}

function buildNomination(identityLoc: Mock<LocRequestAggregateRoot>): VerifiedThirdPartySelectionAggregateRoot {
    const factory = new VerifiedThirdPartySelectionFactory();

    const locRequest = new Mock<LocRequestAggregateRoot>();
    locRequest.setup(instance => instance.id).returns(SELECTION_ID.locRequestId);

    return factory.newNomination({
        verifiedThirdPartyLocRequest: identityLoc.object(),
        locRequest: locRequest.object(),
    })
}

const SELECTION_ID: VerifiedThirdPartySelectionId = {
    locRequestId: "98c54013-af47-409f-b90d-edcdb71e7cb9",
    verifiedThirdPartyLocId: "a3c29d7b-6ad5-44f6-b2df-f09dd841f212",
};
