import { injectable } from "inversify";
import { PolkadotService } from "./polkadot.service";
import { Option, bool } from "@polkadot/types-codec";

@injectable()
export class AuthorityService {

    constructor(
        private polkadotService: PolkadotService
    ){}

    async isLegalOfficer(address: string): Promise<boolean> {
        const api = await this.polkadotService.readyApi();
        const entry:Option<bool> = await api.query.loAuthorityList.legalOfficerSet(address)
        return entry.isSome && entry.unwrap().isTrue
    }
}
