import { injectable } from "inversify";
import { Sponsorship, UUID } from "@logion/node-api";
import { LocRequestRepository } from "../model/locrequest.model.js";
import { PolkadotService } from "@logion/rest-api-core";
import { accountEquals, SupportedAccountId } from "../model/supportedaccountid.model.js";

@injectable()
export class SponsorshipService {

    constructor(
        private polkadotService: PolkadotService,
        private locRequestRepository: LocRequestRepository,
    ) {
    }

    private async getSponsorship(sponsorshipId: UUID): Promise<Sponsorship | undefined> {
        return (await this.polkadotService.queries()).getSponsorship(sponsorshipId);
    }

    async validateSponsorship(sponsorshipId: UUID, legalOfficer: SupportedAccountId, requester: SupportedAccountId): Promise<void> {
        const sponsorship = await this.getSponsorship(sponsorshipId);
        if (sponsorship === undefined) {
            throw new Error("Sponsorship not found")
        }
        if (sponsorship.locId !== undefined) {
            throw Error("This sponsorship is already used in an open/closed/voided LOC")
        }
        if (await this.locRequestRepository.existsBy({ expectedSponsorshipId: sponsorshipId })) {
            throw Error("This sponsorship is already used in a draft/requested LOC")
        }
        if (!accountEquals(sponsorship.legalOfficer, legalOfficer) ||
            !accountEquals(sponsorship.sponsoredAccount, requester)) {
            throw Error("This sponsorship is not applicable to your request")
        }
    }
}
