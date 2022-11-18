import { injectable } from 'inversify';
import { Entity, PrimaryColumn, Repository } from "typeorm";
import { appDataSource, requireDefined } from "@logion/rest-api-core";
import { LocRequestAggregateRoot, LocRequestRepository } from './locrequest.model';

export interface VerifiedThirdPartyNominationId {
    locRequestId: string;
    verifiedThirdPartyLocId: string;
}

@Entity("vtp_nomination")
export class VerifiedThirdPartyNominationAggregateRoot {

    get id(): VerifiedThirdPartyNominationId {
        return {
            locRequestId: requireDefined(this.locRequestId),
            verifiedThirdPartyLocId: requireDefined(this.verifiedThirdPartyLocId),
        };
    }

    @PrimaryColumn({ type: "uuid", name: "loc_request_id" })
    locRequestId?: string;

    @PrimaryColumn({ type: "uuid", name: "vtp_loc_id" })
    verifiedThirdPartyLocId?: string;
}

@injectable()
export class VerifiedThirdPartyNominationRepository {

    constructor() {
        this.repository = appDataSource.getRepository(VerifiedThirdPartyNominationAggregateRoot);
    }

    readonly repository: Repository<VerifiedThirdPartyNominationAggregateRoot>;

    async save(syncPoint: VerifiedThirdPartyNominationAggregateRoot): Promise<void> {
        await this.repository.save(syncPoint);
    }

    async findById(id: VerifiedThirdPartyNominationId): Promise<VerifiedThirdPartyNominationAggregateRoot | null> {
        return await this.repository.findOneBy(id);
    }

    async findByLocRequestId(locRequestId: string): Promise<VerifiedThirdPartyNominationAggregateRoot[]> {
        return this.repository.findBy({ locRequestId });
    }

    async deleteById(id: VerifiedThirdPartyNominationId): Promise<void> {
        await this.repository.delete(id);
    }

    async deleteByVerifiedThirdPartyId(verifiedThirdPartyLocId: string): Promise<void> {
        await this.repository.delete({ verifiedThirdPartyLocId });
    }
}

@injectable()
export class VerifiedThirdPartyNominationFactory {

    async newNomination(args: {
        locRequest: LocRequestAggregateRoot,
        verifiedThirdPartyLocRequest: LocRequestAggregateRoot,
    }): Promise<VerifiedThirdPartyNominationAggregateRoot> {
        const {
            verifiedThirdPartyLocRequest,
            locRequest,
        } = args;

        if(verifiedThirdPartyLocRequest.locType !== "Identity") {
            throw new Error("VTP LOC is not an identity LOC");
        }
        if(verifiedThirdPartyLocRequest.status !== "CLOSED") {
            throw new Error("VTP LOC is not closed");
        }
        if(!verifiedThirdPartyLocRequest.verifiedThirdParty) {
            throw new Error("Party is not verified");
        }

        const root = new VerifiedThirdPartyNominationAggregateRoot();
        root.locRequestId = locRequest.id;
        root.verifiedThirdPartyLocId = verifiedThirdPartyLocRequest.id;
        return root;
    }
}
