import { injectable } from 'inversify';
import { Entity, PrimaryColumn, Repository } from "typeorm";
import { appDataSource, requireDefined } from "@logion/rest-api-core";
import { LocRequestAggregateRoot } from './locrequest.model';

export interface VerifiedThirdPartySelectionId {
    locRequestId: string;
    verifiedThirdPartyLocId: string;
}

@Entity("vtp_selection")
export class VerifiedThirdPartySelectionAggregateRoot {

    get id(): VerifiedThirdPartySelectionId {
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
export class VerifiedThirdPartySelectionRepository {

    constructor() {
        this.repository = appDataSource.getRepository(VerifiedThirdPartySelectionAggregateRoot);
    }

    readonly repository: Repository<VerifiedThirdPartySelectionAggregateRoot>;

    async save(syncPoint: VerifiedThirdPartySelectionAggregateRoot): Promise<void> {
        await this.repository.save(syncPoint);
    }

    async findById(id: VerifiedThirdPartySelectionId): Promise<VerifiedThirdPartySelectionAggregateRoot | null> {
        return await this.repository.findOneBy(id);
    }

    async findBy(partialId: Partial<VerifiedThirdPartySelectionId>): Promise<VerifiedThirdPartySelectionAggregateRoot[]> {
        return this.repository.findBy(partialId);
    }

    async deleteById(id: VerifiedThirdPartySelectionId): Promise<void> {
        await this.repository.delete(id);
    }

    async deleteByVerifiedThirdPartyId(verifiedThirdPartyLocId: string): Promise<void> {
        await this.repository.delete({ verifiedThirdPartyLocId });
    }
}

@injectable()
export class VerifiedThirdPartySelectionFactory {

    async newNomination(args: {
        locRequest: LocRequestAggregateRoot,
        verifiedThirdPartyLocRequest: LocRequestAggregateRoot,
    }): Promise<VerifiedThirdPartySelectionAggregateRoot> {
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

        const root = new VerifiedThirdPartySelectionAggregateRoot();
        root.locRequestId = locRequest.id;
        root.verifiedThirdPartyLocId = verifiedThirdPartyLocRequest.id;
        return root;
    }
}
