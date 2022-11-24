import { AuthenticatedUser } from "@logion/authenticator";
import { DefaultTransactional, requireDefined } from "@logion/rest-api-core";
import { injectable } from "inversify";
import { LocRequestAggregateRoot, LocRequestRepository } from "../model/locrequest.model";
import { VerifiedThirdPartySelectionAggregateRoot, VerifiedThirdPartySelectionFactory, VerifiedThirdPartySelectionId, VerifiedThirdPartySelectionRepository } from "../model/verifiedthirdpartyselection.model";

export abstract class VerifiedThirdPartySelectionService {

    constructor(
        private verifiedThirdPartySelectionFactory: VerifiedThirdPartySelectionFactory,
        private verifiedThirdPartySelectionRepository: VerifiedThirdPartySelectionRepository,
        private locRequestRepository: LocRequestRepository,
    ) {}

    async add(selection: VerifiedThirdPartySelectionAggregateRoot) {
        await this.verifiedThirdPartySelectionRepository.save(selection);
    }

    async selectUnselect(locRequest: LocRequestAggregateRoot, verifiedThirdPartyLocRequest: LocRequestAggregateRoot, select: boolean) {
        const id: VerifiedThirdPartySelectionId = {
            locRequestId: requireDefined(locRequest.id),
            verifiedThirdPartyLocId: requireDefined(verifiedThirdPartyLocRequest.id),
        };
        let selection = await this.verifiedThirdPartySelectionRepository.findById(id);
        if(selection) {
            selection.setSelected(select);
            await this.verifiedThirdPartySelectionRepository.save(selection);
        } else if(select) {
            selection = this.verifiedThirdPartySelectionFactory.newSelection({
                locRequest,
                verifiedThirdPartyLocRequest
            });
            await this.verifiedThirdPartySelectionRepository.save(selection);
        } // else (!selection && !select) -> skip
    }

    async nominateDismiss(authenticatedUser: AuthenticatedUser, verifiedThirdPartyLocId: string, nominate: boolean) {
        const verifiedThirdPartyLocRequest = requireDefined(await this.locRequestRepository.findById(verifiedThirdPartyLocId));
        authenticatedUser.require(user => user.is(verifiedThirdPartyLocRequest.ownerAddress));
        verifiedThirdPartyLocRequest.setVerifiedThirdParty(nominate);
        await this.locRequestRepository.save(verifiedThirdPartyLocRequest);
        if(!nominate) {
            await this.verifiedThirdPartySelectionRepository.unselectAll(verifiedThirdPartyLocId);
        }
        return verifiedThirdPartyLocRequest;
    }
}

@injectable()
export class TransactionalVerifiedThirdPartySelectionService extends VerifiedThirdPartySelectionService {

    constructor(
        verifiedThirdPartySelectionFactory: VerifiedThirdPartySelectionFactory,
        verifiedThirdPartySelectionRepository: VerifiedThirdPartySelectionRepository,
        locRequestRepository: LocRequestRepository,
    ) {
        super(verifiedThirdPartySelectionFactory, verifiedThirdPartySelectionRepository, locRequestRepository);
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
    async nominateDismiss(authenticatedUser: AuthenticatedUser, verifiedThirdPartyLocId: string, nominate: boolean) {
        return super.nominateDismiss(authenticatedUser, verifiedThirdPartyLocId, nominate);
    }
}

@injectable()
export class NonTransactionalVerifiedThirdPartySelectionService extends VerifiedThirdPartySelectionService {

    constructor(
        verifiedThirdPartySelectionFactory: VerifiedThirdPartySelectionFactory,
        verifiedThirdPartySelectionRepository: VerifiedThirdPartySelectionRepository,
        locRequestRepository: LocRequestRepository,
    ) {
        super(verifiedThirdPartySelectionFactory, verifiedThirdPartySelectionRepository, locRequestRepository);
    }
}
