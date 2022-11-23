import { DefaultTransactional } from "@logion/rest-api-core";
import { injectable } from "inversify";
import { VerifiedThirdPartySelectionAggregateRoot, VerifiedThirdPartySelectionId, VerifiedThirdPartySelectionRepository } from "../model/verifiedthirdpartyselection.model";

export abstract class VerifiedThirdPartySelectionService {

    constructor(
        private verifiedThirdPartySelectionRepository: VerifiedThirdPartySelectionRepository,
    ) {}

    async add(selection: VerifiedThirdPartySelectionAggregateRoot) {
        await this.verifiedThirdPartySelectionRepository.save(selection);
    }

    async deleteById(id: VerifiedThirdPartySelectionId) {
        await this.verifiedThirdPartySelectionRepository.deleteById(id);
    }

    async deleteByVerifiedThirdPartyId(verifiedThirdPartyLocId: string) {
        await this.verifiedThirdPartySelectionRepository.deleteByVerifiedThirdPartyId(verifiedThirdPartyLocId);
    }
}

@injectable()
export class TransactionalVerifiedThirdPartySelectionService extends VerifiedThirdPartySelectionService {

    @DefaultTransactional()
    async add(selection: VerifiedThirdPartySelectionAggregateRoot) {
        return super.add(selection);
    }

    @DefaultTransactional()
    async deleteById(id: VerifiedThirdPartySelectionId) {
        return super.deleteById(id);
    }

    @DefaultTransactional()
    async deleteByVerifiedThirdPartyId(verifiedThirdPartyLocId: string) {
        return super.deleteByVerifiedThirdPartyId(verifiedThirdPartyLocId);
    }
}

@injectable()
export class NonTransactionalVerifiedThirdPartySelectionService extends VerifiedThirdPartySelectionService {

}
