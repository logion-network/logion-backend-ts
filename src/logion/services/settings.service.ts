import { DefaultTransactional } from "@logion/rest-api-core";
import { injectable } from "inversify";
import { SettingFactory, SettingRepository, SettingDescription } from "../model/setting.model";

export abstract class SettingService {

    protected constructor(
        private settingRepository: SettingRepository,
        private settingFactory: SettingFactory,
    ) {}

    async createOrUpdate(params: SettingDescription) {
        const { id, legalOfficerAddress, value } = params;
        let setting = await this.settingRepository.findById({ id, legalOfficerAddress });
        if(setting) {
            setting.update(value);
        } else {
            setting = this.settingFactory.newSetting(params);
        }
        await this.settingRepository.save(setting);
    }
}

@injectable()
export class TransactionalSettingService extends SettingService {

    constructor(
        settingRepository: SettingRepository,
        settingFactory: SettingFactory,
    ) {
        super(settingRepository, settingFactory);
    }

    @DefaultTransactional()
    override async createOrUpdate(params: SettingDescription) {
        return super.createOrUpdate(params);
    }
}

@injectable()
export class NonTransactionalSettingService extends SettingService {

    constructor(
        settingRepository: SettingRepository,
        settingFactory: SettingFactory,
    ) {
        super(settingRepository, settingFactory);
    }
}
