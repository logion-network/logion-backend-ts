import { injectable } from 'inversify';
import { Entity, PrimaryColumn, Column, Repository } from "typeorm";
import { appDataSource } from "@logion/rest-api-core";
import { LegalOfficerSettingId } from "./legalofficer.model.js";

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

    async findByLegalOfficer(legalOfficerAddress: string): Promise<SettingAggregateRoot[]> {
        return await this.repository.findBy({ legalOfficerAddress });
    }

    async findById(params: LegalOfficerSettingId): Promise<SettingAggregateRoot | null> {
        return await this.repository.findOneBy(params);
    }
}

export interface SettingDescription extends LegalOfficerSettingId {
    value: string
}

@injectable()
export class SettingFactory {

    newSetting(params: SettingDescription): SettingAggregateRoot {
        const { id, legalOfficerAddress, value } = params;
        const root = new SettingAggregateRoot();
        root.id = id;
        root.legalOfficerAddress = legalOfficerAddress;
        root.value = value;
        return root;
    }
}
