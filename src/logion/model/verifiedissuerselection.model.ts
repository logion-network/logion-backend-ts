import { injectable } from 'inversify';
import { Column, Entity, PrimaryColumn, Repository } from "typeorm";
import { appDataSource, requireDefined } from "@logion/rest-api-core";
import { ValidAccountId } from "@logion/node-api";
import { DB_SS58_PREFIX } from "./supportedaccountid.model.js";

export interface VerifiedIssuerSelectionId {
    locRequestId: string;
    issuer: ValidAccountId;
}

@Entity("issuer_selection")
export class VerifiedIssuerAggregateRoot {

    get id(): VerifiedIssuerSelectionId {
        return {
            locRequestId: requireDefined(this.locRequestId),
            issuer: this.getIssuer(),
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

    getIssuer(): ValidAccountId {
        return ValidAccountId.polkadot(this.issuer || "");
    }
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
        return await this.repository.findOneBy({
            ...id,
            issuer: id.issuer.getAddress(DB_SS58_PREFIX),
        });
    }

    async findBy(spec: FindBySpecification): Promise<VerifiedIssuerAggregateRoot[]> {
        const dbSpec = {
            ...spec,
            issuer: spec.issuer?.getAddress(DB_SS58_PREFIX),
        }
        return this.repository.findBy(dbSpec);
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
        root.issuer = issuer.getAddress(DB_SS58_PREFIX);

        root.identityLocId = identityLocId;
        root.selected = true;

        return root;
    }
}
