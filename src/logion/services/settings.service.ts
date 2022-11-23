import { DefaultTransactional } from "@logion/rest-api-core";
import { injectable } from "inversify";
import { SettingFactory, SettingRepository } from "../model/setting.model";

export abstract class SettingService {

    constructor(
        private settingRepository: SettingRepository,
        private settingFactory: SettingFactory,
    ) {}

    async createOrUpdate(id: string, value: string) {
        let setting = await this.settingRepository.findById(id);
        if(setting) {
            setting.update(value);
        } else {
            setting = this.settingFactory.newSetting({id, value});
        }
        await this.settingRepository.save(setting);
    }
}

@injectable()
export class TransactionalSettingService extends SettingService {

    @DefaultTransactional()
    override async createOrUpdate(id: string, value: string) {
        return super.createOrUpdate(id, value);
    }
}

@injectable()
export class NonTransactionalSettingService extends SettingService {

}
