import { injectable } from 'inversify';
import { Entity, PrimaryColumn, Column, Repository } from "typeorm";
import { appDataSource } from "@logion/rest-api-core";
import { LegalOfficerSettingId } from "./legalofficer.model.js";
import { DB_SS58_PREFIX } from "./supportedaccountid.model.js";
import { ValidAccountId } from "@logion/node-api";

@Entity("setting")
export class SettingAggregateRoot {

    update(newValue: string) {
        this.value = newValue;
    }

    @PrimaryColumn()
    id?: string;

    @PrimaryColumn({ length: 255, name: "legal_officer_address" })
    legalOfficerAddress?: string;

    @Column()
    value?: string;
}

@injectable()
export class SettingRepository {

    constructor() {
        this.repository = appDataSource.getRepository(SettingAggregateRoot);
    }

    readonly repository: Repository<SettingAggregateRoot>;

    async save(setting: SettingAggregateRoot): Promise<void> {
        await this.repository.save(setting);
    }

    async findByLegalOfficer(legalOfficer: ValidAccountId): Promise<SettingAggregateRoot[]> {
        return await this.repository.findBy({
            legalOfficerAddress: legalOfficer.getAddress(DB_SS58_PREFIX)
        });
    }

    async findById(params: LegalOfficerSettingId): Promise<SettingAggregateRoot | null> {
        return await this.repository.findOneBy({
            id: params.id,
            legalOfficerAddress: params.legalOfficer.getAddress(DB_SS58_PREFIX),
        });
    }
}

export interface SettingDescription extends LegalOfficerSettingId {
    value: string
}

@injectable()
export class SettingFactory {

    newSetting(params: SettingDescription): SettingAggregateRoot {
        const { id, legalOfficer, value } = params;
        const root = new SettingAggregateRoot();
        root.id = id;
        root.legalOfficerAddress = legalOfficer.getAddress(DB_SS58_PREFIX);
        root.value = value;
        return root;
    }
}
