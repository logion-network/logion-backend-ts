import { DefaultTransactional, requireDefined } from "@logion/rest-api-core";
import { injectable } from "inversify";
import { LocRequestAggregateRoot } from "../model/locrequest.model.js";
import { VerifiedIssuerAggregateRoot, VerifiedIssuerSelectionFactory, VerifiedIssuerSelectionId, VerifiedIssuerSelectionRepository } from "../model/verifiedissuerselection.model.js";

export abstract class VerifiedIssuerSelectionService {

    constructor(
        private verifiedIssuerSelectionFactory: VerifiedIssuerSelectionFactory,
        private verifiedIssuerSelectionRepository: VerifiedIssuerSelectionRepository,
    ) {}

    async add(selection: VerifiedIssuerAggregateRoot) {
        await this.verifiedIssuerSelectionRepository.save(selection);
    }

    async selectUnselect(locRequest: LocRequestAggregateRoot, verifiedIssuerLocRequest: LocRequestAggregateRoot, select: boolean) {
        const id: VerifiedIssuerSelectionId = {
            locRequestId: requireDefined(locRequest.id),
            issuer: requireDefined(verifiedIssuerLocRequest.requesterAddress),
        };
        let selection = await this.verifiedIssuerSelectionRepository.findById(id);
        if(selection) {
            selection.setSelected(select);
            await this.verifiedIssuerSelectionRepository.save(selection);
        } else if(select) {
            selection = this.verifiedIssuerSelectionFactory.newSelection(id, requireDefined(verifiedIssuerLocRequest.id));
            await this.verifiedIssuerSelectionRepository.save(selection);
        } // else (!selection && !select) -> skip
    }

    async unselectAll(issuerAddress: string) {
        await this.verifiedIssuerSelectionRepository.unselectAll(issuerAddress);
    }
}

@injectable()
export class TransactionalVerifiedIssuerSelectionService extends VerifiedIssuerSelectionService {

    constructor(
        verifiedThirdPartySelectionFactory: VerifiedIssuerSelectionFactory,
        verifiedThirdPartySelectionRepository: VerifiedIssuerSelectionRepository,
    ) {
        super(verifiedThirdPartySelectionFactory, verifiedThirdPartySelectionRepository);
    }

    @DefaultTransactional()
    async add(selection: VerifiedIssuerAggregateRoot) {
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
export class NonTransactionalVerifiedIssuerSelectionService extends VerifiedIssuerSelectionService {

    constructor(
        verifiedThirdPartySelectionFactory: VerifiedIssuerSelectionFactory,
        verifiedThirdPartySelectionRepository: VerifiedIssuerSelectionRepository,
    ) {
        super(verifiedThirdPartySelectionFactory, verifiedThirdPartySelectionRepository);
    }
}
