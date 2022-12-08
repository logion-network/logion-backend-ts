import { Entity, Column, PrimaryColumn, Repository } from "typeorm";
import { injectable } from "inversify";

import { appDataSource } from "@logion/rest-api-core";
import { LegalOfficerSettingId } from "./legalofficer.model";

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
        return this.repository.findOneBy(params)
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
        root.legalOfficerAddress = description.legalOfficerAddress;
        root.contentType = description.contentType;
        root.oid = description.oid;
        return root;
    }
}
