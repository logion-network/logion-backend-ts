import { DefaultTransactional, requireDefined } from "@logion/rest-api-core";
import { injectable } from "inversify";
import { LocRequestAggregateRoot } from "../model/locrequest.model.js";
import { VerifiedIssuerAggregateRoot, VerifiedIssuerSelectionFactory, VerifiedIssuerSelectionId, VerifiedIssuerSelectionRepository } from "../model/verifiedissuerselection.model.js";
import { ValidAccountId } from "@logion/node-api";

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
            issuer: requireDefined(verifiedIssuerLocRequest.getRequester()),
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

    async unselectAll(issuerAccount: ValidAccountId) {
        await this.verifiedIssuerSelectionRepository.unselectAll(issuerAccount);
    }
}

@injectable()
export class TransactionalVerifiedIssuerSelectionService extends VerifiedIssuerSelectionService {

    constructor(
        verifiedIssuerSelectionFactory: VerifiedIssuerSelectionFactory,
        verifiedIssuerSelectionRepository: VerifiedIssuerSelectionRepository,
    ) {
        super(verifiedIssuerSelectionFactory, verifiedIssuerSelectionRepository);
    }

    @DefaultTransactional()
    async add(selection: VerifiedIssuerAggregateRoot) {
        return super.add(selection);
    }

    @DefaultTransactional()
    async selectUnselect(locRequest: LocRequestAggregateRoot, verifiedIssuerLocRequest: LocRequestAggregateRoot, select: boolean) {
        return super.selectUnselect(locRequest, verifiedIssuerLocRequest, select);
    }

    @DefaultTransactional()
    async unselectAll(issuerAccount: ValidAccountId) {
        return super.unselectAll(issuerAccount);
    }
}

@injectable()
export class NonTransactionalVerifiedIssuerSelectionService extends VerifiedIssuerSelectionService {

    constructor(
        verifiedIssuerSelectionFactory: VerifiedIssuerSelectionFactory,
        verifiedIssuerSelectionRepository: VerifiedIssuerSelectionRepository,
    ) {
        super(verifiedIssuerSelectionFactory, verifiedIssuerSelectionRepository);
    }
}
