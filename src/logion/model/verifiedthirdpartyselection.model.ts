import { injectable } from 'inversify';
import { Column, Entity, PrimaryColumn, Repository } from "typeorm";
import { appDataSource, requireDefined } from "@logion/rest-api-core";

export interface VerifiedThirdPartySelectionId {
    locRequestId: string;
    issuer: string;
}

@Entity("vtp_selection")
export class VerifiedThirdPartySelectionAggregateRoot {

    get id(): VerifiedThirdPartySelectionId {
        return {
            locRequestId: requireDefined(this.locRequestId),
            issuer: requireDefined(this.issuer),
        };
    }

    setSelected(value: boolean) {
        this.selected = value;
    }

    @PrimaryColumn({ type: "uuid", name: "loc_request_id" })
    locRequestId?: string;

    @PrimaryColumn({ type: "varchar", name: "issuer" })
    issuer?: string;

    @Column({ type: "uuid", name: "vtp_loc_id" })
    identityLocId?: string;

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

    async unselectAll(issuer: string) {
        await this.repository.update({ issuer }, { selected: false });
    }
}

@injectable()
export class VerifiedThirdPartySelectionFactory {

    newSelection(id: VerifiedThirdPartySelectionId, identityLocId: string): VerifiedThirdPartySelectionAggregateRoot {
        const {
            locRequestId,
            issuer,
        } = id;

        const root = new VerifiedThirdPartySelectionAggregateRoot();
        root.locRequestId = locRequestId;
        root.issuer = issuer;

        root.identityLocId = identityLocId;
        root.selected = true;

        return root;
    }
}
