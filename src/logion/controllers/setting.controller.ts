import { injectable } from 'inversify';
import { ApiController, Controller, HttpPut, Async, HttpGet } from 'dinoloop';
import { SettingRepository } from '../model/setting.model';
import { addTag, AuthenticationService, getDefaultResponsesWithAnyBody, setControllerTag, setPathParameters } from '@logion/rest-api-core';
import { OpenAPIV3 } from "express-oas-generator";
import { SettingService } from '../services/settings.service';

export function fillInSpec(spec: OpenAPIV3.Document): void {
    const tagName = 'Settings';
    addTag(spec, {
        name: tagName,
        description: "Handling of Legal Officer Settings"
    });
    setControllerTag(spec, /^\/api\/setting.*/, tagName);

    SettingController.fetchSettings(spec);
    SettingController.createOrUpdate(spec);
}

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

    static fetchSettings(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/setting/{legalOfficer}"].get!;
        operationObject.summary = "Lists all Legal Officer's settings";
        operationObject.description = "The authenticated user must be a LO attached to the node.";
        operationObject.responses = getDefaultResponsesWithAnyBody();
        setPathParameters(operationObject, {
            legalOfficer: "The address of the LO"
        });
    }

    @Async()
    @HttpGet('/:legalOfficer')
    async fetchSettings(_body: never, _legalOfficer: string): Promise<{settings: Record<string, string>}> {
        await this.authenticationService.authenticatedUserIsLegalOfficerOnNode(this.request);
        const settings = await this.settingRepository.findAll();
        const responseBody: Record<string, string> = {};
        for(const setting of settings) {
            responseBody[setting.id!] = setting.value!;
        }
        return { settings: responseBody };
    }

    static createOrUpdate(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/setting/{legalOfficer}/{id}"].put!;
        operationObject.summary = "Updates a Legal Officer's setting";
        operationObject.description = "The authenticated user must be a LO attached to the node.";
        operationObject.responses = getDefaultResponsesWithAnyBody();
        setPathParameters(operationObject, {
            legalOfficer: "The address of the LO",
            id: "The key of the setting to update",
        });
    }

    @Async()
    @HttpPut('/:legalOfficer/:id')
    async createOrUpdate(body: { value: string }, _legalOfficer: string, id: string): Promise<void> {
        await this.authenticationService.authenticatedUserIsLegalOfficerOnNode(this.request);
        const value = body.value;
        await this.settingService.createOrUpdate(id, value);
    }
}
