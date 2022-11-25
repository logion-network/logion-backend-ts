import { injectable } from 'inversify';
import { Column, Entity, PrimaryColumn, Repository } from "typeorm";
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

    setSelected(value: boolean) {
        this.selected = value;
    }

    @PrimaryColumn({ type: "uuid", name: "loc_request_id" })
    locRequestId?: string;

    @PrimaryColumn({ type: "uuid", name: "vtp_loc_id" })
    verifiedThirdPartyLocId?: string;

    @Column("boolean", { default: true })
    selected?: boolean;
}

export interface FindBySpecification extends Partial<VerifiedThirdPartySelectionId> {
    selected?: boolean;
}

@injectable()
export class VerifiedThirdPartySelectionRepository {

    constructor() {
        this.repository = appDataSource.getRepository(VerifiedThirdPartySelectionAggregateRoot);
    }

    readonly repository: Repository<VerifiedThirdPartySelectionAggregateRoot>;

    async save(selection: VerifiedThirdPartySelectionAggregateRoot): Promise<void> {
        await this.repository.save(selection);
    }

    async findById(id: VerifiedThirdPartySelectionId): Promise<VerifiedThirdPartySelectionAggregateRoot | null> {
        return await this.repository.findOneBy(id);
    }

    async findBy(spec: FindBySpecification): Promise<VerifiedThirdPartySelectionAggregateRoot[]> {
        return this.repository.findBy(spec);
    }

    async unselectAll(verifiedThirdPartyLocId: string) {
        await this.repository.update({ verifiedThirdPartyLocId }, { selected: false });
    }
}

@injectable()
export class VerifiedThirdPartySelectionFactory {

    newSelection(args: {
        locRequest: LocRequestAggregateRoot,
        verifiedThirdPartyLocRequest: LocRequestAggregateRoot,
    }): VerifiedThirdPartySelectionAggregateRoot {
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
        if(locRequest.requesterAddress === verifiedThirdPartyLocRequest.requesterAddress) {
            throw new Error("Cannot select LOC requester as VTP");
        }

        const root = new VerifiedThirdPartySelectionAggregateRoot();
        root.locRequestId = locRequest.id;
        root.verifiedThirdPartyLocId = verifiedThirdPartyLocRequest.id;
        root.selected = true;
        return root;
    }
}
