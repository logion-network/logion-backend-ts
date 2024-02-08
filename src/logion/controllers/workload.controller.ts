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
import { WorkloadService } from "../services/workload.service.js";

export function fillInSpec(spec: OpenAPIV3.Document): void {
    const tagName = 'Workload';
    addTag(spec, {
        name: tagName,
        description: "Legal-officer workload"
    });
    setControllerTag(spec, /^\/api\/workload.*/, tagName);

    WorkloadController.getWorkload(spec);
}

type WorkloadView = components["schemas"]["WorkloadView"];

@injectable()
@Controller('/workload')
export class WorkloadController extends ApiController {

    constructor(
        private authenticationService: AuthenticationService,
        private workloadService: WorkloadService,
    ) {
        super();
    }

    static getWorkload(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/workload/{legalOfficerAddress}"].get!;
        operationObject.summary = "Provides the workload of a given legal officer";
        operationObject.description = "Requires authentication.";
        operationObject.responses = getDefaultResponses("WorkloadView");
    }

    @HttpGet('/:legalOfficerAddress')
    @Async()
    async getWorkload(legalOfficerAddress: string): Promise<WorkloadView> {
        await this.authenticationService.authenticatedUser(this.request);
        return {
            workload: await this.workloadService.workloadOf(legalOfficerAddress),
        }
    }
}
