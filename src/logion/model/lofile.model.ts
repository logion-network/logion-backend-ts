import { Entity, Column, PrimaryColumn, Repository } from "typeorm";
import { injectable } from "inversify";

import { appDataSource } from "@logion/rest-api-core";
import { LegalOfficerSettingId } from "./legalofficer.model.js";
import { DB_SS58_PREFIX } from "./supportedaccountid.model.js";

@Entity("lo_file")
export class LoFileAggregateRoot {

    @PrimaryColumn({ length: 255 })
    id?: string

    @PrimaryColumn({ length: 255, name: "legal_officer_address" })
    legalOfficerAddress?: string;

    @Column({ length: 255, name: "content_type" })
    contentType?: string;

    @Column("int4")
    oid?: number;

    update(params: { contentType: string, oid: number }) {
        this.contentType = params.contentType;
        this.oid = params.oid;
    }
}

export interface LoFileDescription extends LegalOfficerSettingId {
    readonly contentType: string,
    readonly oid: number,
}

@injectable()
export class LoFileRepository {

    constructor() {
        this.repository = appDataSource.getRepository(LoFileAggregateRoot);
    }

    readonly repository: Repository<LoFileAggregateRoot>;

    public async findById(params: LegalOfficerSettingId): Promise<LoFileAggregateRoot | null> {
        return this.repository.findOneBy({
            id: params.id,
            legalOfficerAddress: params.legalOfficer.getAddress(DB_SS58_PREFIX)
        })
    }

    public async save(root: LoFileAggregateRoot): Promise<void> {
        await this.repository.save(root)
    }
}

@injectable()
export class LoFileFactory {

    public newLoFile(description: LoFileDescription): LoFileAggregateRoot {
        const root = new LoFileAggregateRoot();
        root.id = description.id;
        root.legalOfficerAddress = description.legalOfficer.getAddress(DB_SS58_PREFIX);
        root.contentType = description.contentType;
        root.oid = description.oid;
        return root;
    }
}
