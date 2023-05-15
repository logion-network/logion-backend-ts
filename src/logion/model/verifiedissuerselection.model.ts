import { injectable } from 'inversify';
import { Column, Entity, PrimaryColumn, Repository } from "typeorm";
import { appDataSource, requireDefined } from "@logion/rest-api-core";

export interface VerifiedIssuerSelectionId {
    locRequestId: string;
    issuer: string;
}

@Entity("issuer_selection")
export class VerifiedIssuerAggregateRoot {

    get id(): VerifiedIssuerSelectionId {
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

    @Column({ type: "uuid", name: "issuer_loc_id" })
    identityLocId?: string;

    @Column("boolean", { default: true })
    selected?: boolean;
}

export interface FindBySpecification extends Partial<VerifiedIssuerSelectionId> {
    selected?: boolean;
}

@injectable()
export class VerifiedIssuerSelectionRepository {

    constructor() {
        this.repository = appDataSource.getRepository(VerifiedIssuerAggregateRoot);
    }

    readonly repository: Repository<VerifiedIssuerAggregateRoot>;

    async save(selection: VerifiedIssuerAggregateRoot): Promise<void> {
        await this.repository.save(selection);
    }

    async findById(id: VerifiedIssuerSelectionId): Promise<VerifiedIssuerAggregateRoot | null> {
        return await this.repository.findOneBy(id);
    }

    async findBy(spec: FindBySpecification): Promise<VerifiedIssuerAggregateRoot[]> {
        return this.repository.findBy(spec);
    }

    async unselectAll(issuer: string) {
        await this.repository.update({ issuer }, { selected: false });
    }
}

@injectable()
export class VerifiedIssuerSelectionFactory {

    newSelection(id: VerifiedIssuerSelectionId, identityLocId: string): VerifiedIssuerAggregateRoot {
        const {
            locRequestId,
            issuer,
        } = id;

        const root = new VerifiedIssuerAggregateRoot();
        root.locRequestId = locRequestId;
        root.issuer = issuer;

        root.identityLocId = identityLocId;
        root.selected = true;

        return root;
    }
}
