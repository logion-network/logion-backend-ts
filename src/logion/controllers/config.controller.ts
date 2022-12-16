import { injectable } from "inversify";
import { Controller, ApiController, Async, HttpGet } from "dinoloop";
import { components } from "./components.js";
import { OpenAPIV3 } from "express-oas-generator";
import {
    addTag,
    setControllerTag,
    AuthenticationService,
    getDefaultResponses,
} from "@logion/rest-api-core";

export function fillInSpec(spec: OpenAPIV3.Document): void {
    const tagName = 'Config';
    addTag(spec, {
        name: tagName,
        description: "Backend configuration"
    });
    setControllerTag(spec, /^\/api\/config.*/, tagName);

    ConfigController.getConfig(spec);
}

type Config = components["schemas"]["Config"];

@injectable()
@Controller('/config')
export class ConfigController extends ApiController {

    constructor(
        private authenticationService: AuthenticationService,
    ) {
        super();
    }

    static getConfig(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/config"].get!;
        operationObject.summary = "Provides the backend configuration elements relevant to clients";
        operationObject.description = "Requires authentication.";
        operationObject.responses = getDefaultResponses("Config");
    }

    @HttpGet('')
    @Async()
    async getConfig(): Promise<Config> {
        await this.authenticationService.authenticatedUser(this.request);
        return {
            integrations: {
                iDenfy: process.env.IDENFY_SECRET !== undefined,
            }
        }
    }
}
