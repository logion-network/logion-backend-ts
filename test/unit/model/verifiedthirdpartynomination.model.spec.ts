import { Mock } from "moq.ts";
import { LocRequestAggregateRoot, LocRequestStatus, LocType } from "../../../src/logion/model/locrequest.model";
import { VerifiedThirdPartyNominationAggregateRoot, VerifiedThirdPartyNominationFactory, VerifiedThirdPartyNominationId } from "../../../src/logion/model/verifiedthirdpartynomination.model";

describe("VerifiedThirdPartyNominationFactory", () => {

    it("creates new nomination for VTP", async () => {
        const identityLoc = buildIdentityLoc("Identity", "CLOSED", true);
        const nomination = await buildNomination(identityLoc);
        expect(nomination.id).toEqual(NOMINATION_ID);
    });

    it("fails creating nomination with non-Identity LOC", async () => {
        const identityLoc = buildIdentityLoc("Collection", "CLOSED", false);
        await expectAsync(buildNomination(identityLoc)).toBeRejectedWithError("VTP LOC is not an identity LOC");
    });

    it("fails creating nomination with non-closed Identity LOC", async () => {
        const identityLoc = buildIdentityLoc("Identity", "OPEN", false);
        await expectAsync(buildNomination(identityLoc)).toBeRejectedWithError("VTP LOC is not closed");
    });

    it("fails creating nomination with non-verified Identity LOC", async () => {
        const identityLoc = buildIdentityLoc("Identity", "CLOSED", false);
        await expectAsync(buildNomination(identityLoc)).toBeRejectedWithError("Party is not verified");
    });
});

function buildIdentityLoc(locType: LocType, status: LocRequestStatus, verifiedThirdParty: boolean): Mock<LocRequestAggregateRoot> {
    const identityLoc = new Mock<LocRequestAggregateRoot>();
    identityLoc.setup(instance => instance.id).returns(NOMINATION_ID.verifiedThirdPartyLocId);
    identityLoc.setup(instance => instance.locType).returns(locType);
    identityLoc.setup(instance => instance.status).returns(status);
    identityLoc.setup(instance => instance.verifiedThirdParty).returns(verifiedThirdParty);
    return identityLoc;
}

function buildNomination(identityLoc: Mock<LocRequestAggregateRoot>): Promise<VerifiedThirdPartyNominationAggregateRoot> {
    const factory = new VerifiedThirdPartyNominationFactory();

    const locRequest = new Mock<LocRequestAggregateRoot>();
    locRequest.setup(instance => instance.id).returns(NOMINATION_ID.locRequestId);

    return factory.newNomination({
        verifiedThirdPartyLocRequest: identityLoc.object(),
        locRequest: locRequest.object(),
    })
}

const NOMINATION_ID: VerifiedThirdPartyNominationId = {
    locRequestId: "98c54013-af47-409f-b90d-edcdb71e7cb9",
    verifiedThirdPartyLocId: "a3c29d7b-6ad5-44f6-b2df-f09dd841f212",
};
