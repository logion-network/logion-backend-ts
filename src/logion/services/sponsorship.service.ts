import { injectable } from "inversify";
import { Sponsorship, UUID, ValidAccountId } from "@logion/node-api";
import { LocRequestRepository } from "../model/locrequest.model.js";
import { PolkadotService } from "@logion/rest-api-core";
import { validAccountId } from "../model/supportedaccountid.model.js";

@injectable()
export class SponsorshipService {

    constructor(
        private polkadotService: PolkadotService,
        private locRequestRepository: LocRequestRepository,
    ) {
    }

    private async getSponsorship(sponsorshipId: UUID): Promise<Sponsorship | undefined> {
        return (await this.polkadotService.readyApi()).queries.getSponsorship(sponsorshipId);
    }

    async validateSponsorship(sponsorshipId: UUID, legalOfficer: ValidAccountId, requester: ValidAccountId): Promise<void> {
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
        if (!legalOfficer.equals(validAccountId(sponsorship.legalOfficer)) ||
            !requester.equals(validAccountId(sponsorship.sponsoredAccount))) {
            throw Error("This sponsorship is not applicable to your request")
        }
    }
}
