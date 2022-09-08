import { injectable } from "inversify";
import { PolkadotService } from "./polkadot.service";

@injectable()
export class AuthorityService {

    constructor(
        private polkadotService: PolkadotService
    ){}

    async isLegalOfficer(address: string): Promise<boolean> {
        const api = await this.polkadotService.readyApi();
        const entry = await api.query.loAuthorityList.legalOfficerSet(address);
        return entry.isSome;
    }
}
