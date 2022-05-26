import { injectable } from 'inversify';
import { Entity, PrimaryColumn, Column, getRepository, Repository } from "typeorm";

@Entity("setting")
export class SettingAggregateRoot {

    update(newValue: string) {
        this.value = newValue;
    }

    @PrimaryColumn()
    id?: string;

    @Column()
    value?: string;
}

@injectable()
export class SettingRepository {

    constructor() {
        this.repository = getRepository(SettingAggregateRoot);
    }

    readonly repository: Repository<SettingAggregateRoot>;

    async save(syncPoint: SettingAggregateRoot): Promise<void> {
        await this.repository.save(syncPoint);
    }

    async findAll(): Promise<SettingAggregateRoot[]> {
        return await this.repository.find();
    }

    async findById(id: string): Promise<SettingAggregateRoot | undefined> {
        return await this.repository.findOne(id);
    }
}

@injectable()
export class SettingFactory {

    newSetting(params: {
        id: string,
        value: string,
    }): SettingAggregateRoot {
        const { id, value } = params;
        const root = new SettingAggregateRoot();
        root.id = id;
        root.value = value;
        return root;
    }
}
