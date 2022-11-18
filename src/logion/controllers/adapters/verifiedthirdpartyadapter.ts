import { requireDefined } from "@logion/rest-api-core";
import { injectable } from "inversify";
import { LocRequestAggregateRoot, LocRequestRepository } from "../../model/locrequest.model";
import { PostalAddress } from "../../model/postaladdress";
import { UserIdentity } from "../../model/useridentity";
import { VerifiedThirdPartySelectionAggregateRoot, VerifiedThirdPartySelectionRepository } from "../../model/verifiedthirdpartyselection.model";
import { components } from "../components";

export type UserPrivateData = {
    identityLocId: string | undefined,
    userIdentity: UserIdentity | undefined,
    userPostalAddress: PostalAddress | undefined
};

type VerifiedThirdPartyView = components["schemas"]["VerifiedThirdPartyView"];
type VerifiedThirdPartiesView = components["schemas"]["VerifiedThirdPartiesView"];

@injectable()
export class VerifiedThirdPartyAdapter {

    constructor(
        private locRequestRepository: LocRequestRepository,
        private verifiedThirdPartyNominationRepository: VerifiedThirdPartySelectionRepository,
    ) {}

    async nominatedParties(locRequestId: string): Promise<VerifiedThirdPartyView[]> {
        const nominatedParties = await this.verifiedThirdPartyNominationRepository.findBy({ locRequestId });
        const parties = [];
        for(const nomination of nominatedParties) {
            parties.push(await this.toVerifiedThirdPartyView(nomination));
        }
        return parties;
    }

    private async toVerifiedThirdPartyView(verifiedThirdPartyNomination: VerifiedThirdPartySelectionAggregateRoot): Promise<VerifiedThirdPartyView> {
        const identityLocId = requireDefined(verifiedThirdPartyNomination.verifiedThirdPartyLocId);
        const identityLocRequest = requireDefined(await this.locRequestRepository.findById(identityLocId));
        return this.toView(identityLocRequest);
    }

    toView(identityLocRequest: LocRequestAggregateRoot): VerifiedThirdPartyView {
        const description = identityLocRequest.getDescription();
        return {
            identityLocId: identityLocRequest.id,
            firstName: requireDefined(description.userIdentity?.firstName),
            lastName: requireDefined(description.userIdentity?.lastName),
        };
    }

    toViews(identityLocRequests: LocRequestAggregateRoot[]): VerifiedThirdPartiesView {
        return {
            verifiedThirdParties: identityLocRequests.map(this.toView).sort(this.compareParties)
        };
    }

    private compareParties(party1: VerifiedThirdPartyView, party2: VerifiedThirdPartyView): number {
        const party1LastName = requireDefined(party1.lastName);
        const party2LastName = requireDefined(party2.lastName);
        return party1LastName.localeCompare(party2LastName);
    }
}
