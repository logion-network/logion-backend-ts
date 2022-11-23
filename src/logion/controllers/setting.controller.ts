import { injectable } from 'inversify';
import { ApiController, Controller, HttpPut, Async, HttpGet } from 'dinoloop';
import { SettingRepository } from '../model/setting.model';
import { AuthenticationService } from '@logion/rest-api-core';
import { SettingService } from '../services/settings.service';

@injectable()
@Controller('/setting')
export class SettingController extends ApiController {

    constructor(
        private settingRepository: SettingRepository,
        private authenticationService: AuthenticationService,
        private settingService: SettingService,
    ) {
        super();
    }

    @Async()
    @HttpGet('')
    async fetchSettings(): Promise<{settings: Record<string, string>}> {
        (await this.authenticationService.authenticatedUser(this.request))
            .require(user => user.isNodeOwner());
        const settings = await this.settingRepository.findAll();
        const responseBody: Record<string, string> = {};
        for(const setting of settings) {
            responseBody[setting.id!] = setting.value!;
        }
        return { settings: responseBody };
    }

    @Async()
    @HttpPut('/:id')
    async createOrUpdate(body: { value: string }, id: string): Promise<void> {
        (await this.authenticationService.authenticatedUser(this.request))
            .require(user => user.isNodeOwner());
        const value = body.value;
        await this.settingService.createOrUpdate(id, value);
    }
}
