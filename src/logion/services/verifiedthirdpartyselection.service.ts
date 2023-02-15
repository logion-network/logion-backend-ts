import { DefaultTransactional, requireDefined } from "@logion/rest-api-core";
import { injectable } from "inversify";
import { LocRequestAggregateRoot } from "../model/locrequest.model.js";
import { VerifiedThirdPartySelectionAggregateRoot, VerifiedThirdPartySelectionFactory, VerifiedThirdPartySelectionId, VerifiedThirdPartySelectionRepository } from "../model/verifiedthirdpartyselection.model.js";

export abstract class VerifiedThirdPartySelectionService {

    constructor(
        private verifiedThirdPartySelectionFactory: VerifiedThirdPartySelectionFactory,
        private verifiedThirdPartySelectionRepository: VerifiedThirdPartySelectionRepository,
    ) {}

    async add(selection: VerifiedThirdPartySelectionAggregateRoot) {
        await this.verifiedThirdPartySelectionRepository.save(selection);
    }

    async selectUnselect(locRequest: LocRequestAggregateRoot, verifiedThirdPartyLocRequest: LocRequestAggregateRoot, select: boolean) {
        const id: VerifiedThirdPartySelectionId = {
            locRequestId: requireDefined(locRequest.id),
            issuer: requireDefined(verifiedThirdPartyLocRequest.requesterAddress),
        };
        let selection = await this.verifiedThirdPartySelectionRepository.findById(id);
        if(selection) {
            selection.setSelected(select);
            await this.verifiedThirdPartySelectionRepository.save(selection);
        } else if(select) {
            selection = this.verifiedThirdPartySelectionFactory.newSelection(id, requireDefined(verifiedThirdPartyLocRequest.id));
            await this.verifiedThirdPartySelectionRepository.save(selection);
        } // else (!selection && !select) -> skip
    }

    async unselectAll(issuerAddress: string) {
        await this.verifiedThirdPartySelectionRepository.unselectAll(issuerAddress);
    }
}

@injectable()
export class TransactionalVerifiedThirdPartySelectionService extends VerifiedThirdPartySelectionService {

    constructor(
        verifiedThirdPartySelectionFactory: VerifiedThirdPartySelectionFactory,
        verifiedThirdPartySelectionRepository: VerifiedThirdPartySelectionRepository,
    ) {
        super(verifiedThirdPartySelectionFactory, verifiedThirdPartySelectionRepository);
    }

    @DefaultTransactional()
    async add(selection: VerifiedThirdPartySelectionAggregateRoot) {
        return super.add(selection);
    }

    @DefaultTransactional()
    async selectUnselect(locRequest: LocRequestAggregateRoot, verifiedThirdPartyLocRequest: LocRequestAggregateRoot, select: boolean) {
        return super.selectUnselect(locRequest, verifiedThirdPartyLocRequest, select);
    }

    @DefaultTransactional()
    async unselectAll(issuerAddress: string) {
        return super.unselectAll(issuerAddress);
    }
}

@injectable()
export class NonTransactionalVerifiedThirdPartySelectionService extends VerifiedThirdPartySelectionService {

    constructor(
        verifiedThirdPartySelectionFactory: VerifiedThirdPartySelectionFactory,
        verifiedThirdPartySelectionRepository: VerifiedThirdPartySelectionRepository,
    ) {
        super(verifiedThirdPartySelectionFactory, verifiedThirdPartySelectionRepository);
    }
}
