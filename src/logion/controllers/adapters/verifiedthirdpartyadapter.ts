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

    async selectedParties(locRequestId: string): Promise<VerifiedThirdPartyView[]> {
        const nominatedParties = await this.verifiedThirdPartyNominationRepository.findBy({ locRequestId });
        const parties = [];
        for(const nomination of nominatedParties) {
            parties.push(await this.toVerifiedThirdPartyView(nomination));
        }
        return parties;
    }

    private async toVerifiedThirdPartyView(verifiedThirdPartySelection: VerifiedThirdPartySelectionAggregateRoot): Promise<VerifiedThirdPartyView> {
        const identityLocId = requireDefined(verifiedThirdPartySelection.id.verifiedThirdPartyLocId);
        const identityLocRequest = requireDefined(await this.locRequestRepository.findById(identityLocId));
        return this.toView(identityLocRequest, verifiedThirdPartySelection.selected);
    }

    toView(identityLocRequest: LocRequestAggregateRoot, selected?: boolean): VerifiedThirdPartyView {
        const description = identityLocRequest.getDescription();
        return {
            identityLocId: identityLocRequest.id,
            address: identityLocRequest.requesterAddress,
            firstName: description.userIdentity?.firstName,
            lastName: description.userIdentity?.lastName,
            selected,
        };
    }

    toViews(identityLocRequests: LocRequestAggregateRoot[]): VerifiedThirdPartiesView {
        return {
            verifiedThirdParties: identityLocRequests.map(request => this.toView(request)).sort(this.compareParties)
        };
    }

    private compareParties(party1: VerifiedThirdPartyView, party2: VerifiedThirdPartyView): number {
        const party1LastName = requireDefined(party1.lastName);
        const party2LastName = requireDefined(party2.lastName);
        return party1LastName.localeCompare(party2LastName);
    }
}
