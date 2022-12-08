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
        const operationObject = spec.paths["/api/setting/{legalOfficerAddress}"].get!;
        operationObject.summary = "Lists all Legal Officer's settings";
        operationObject.description = "The authenticated user must be a LO attached to the node.";
        operationObject.responses = getDefaultResponsesWithAnyBody();
        setPathParameters(operationObject, {
            legalOfficerAddress: "The address of the LO"
        });
    }

    @Async()
    @HttpGet('/:legalOfficerAddress')
    async fetchSettings(_body: never, legalOfficerAddress: string): Promise<{settings: Record<string, string>}> {
        const authenticatedUser = await this.authenticationService.authenticatedUserIsLegalOfficerOnNode(this.request);
        authenticatedUser.require(user => user.is(legalOfficerAddress));
        const settings = await this.settingRepository.findByLegalOfficer(legalOfficerAddress);
        const responseBody: Record<string, string> = {};
        for(const setting of settings) {
            responseBody[setting.id!] = setting.value!;
        }
        return { settings: responseBody };
    }

    static createOrUpdate(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/setting/{legalOfficerAddress}/{id}"].put!;
        operationObject.summary = "Updates a Legal Officer's setting";
        operationObject.description = "The authenticated user must be a LO attached to the node.";
        operationObject.responses = getDefaultResponsesWithAnyBody();
        setPathParameters(operationObject, {
            legalOfficerAddress: "The address of the LO",
            id: "The key of the setting to update",
        });
    }

    @Async()
    @HttpPut('/:legalOfficerAddress/:id')
    async createOrUpdate(body: { value: string }, legalOfficerAddress: string, id: string): Promise<void> {
        const authenticatedUser = await this.authenticationService.authenticatedUserIsLegalOfficerOnNode(this.request);
        authenticatedUser.require(user => user.is(legalOfficerAddress));
        const value = body.value;
        await this.settingService.createOrUpdate({ id, legalOfficerAddress, value });
    }
}
