import { injectable } from "inversify";
import { Controller, ApiController, Async, HttpPut } from "dinoloop";
import { components } from "./components.js";
import { OpenAPIV3 } from "express-oas-generator";
import {
    addTag,
    setControllerTag,
    AuthenticationService,
    getDefaultResponses,
} from "@logion/rest-api-core";
import { WorkloadService } from "../services/workload.service.js";
import { ValidAccountId } from "@logion/node-api";

export function fillInSpec(spec: OpenAPIV3.Document): void {
    const tagName = 'Workload';
    addTag(spec, {
        name: tagName,
        description: "Legal-officer workload"
    });
    setControllerTag(spec, /^\/api\/workload.*/, tagName);

    WorkloadController.getWorkloads(spec);
}

type FetchWorkloadsView = components["schemas"]["FetchWorkloadsView"];
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

    static getWorkloads(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/workload"].put!;
        operationObject.summary = "Provides the workloads of given legal officers";
        operationObject.description = "Requires authentication.";
        operationObject.responses = getDefaultResponses("WorkloadView");
    }

    @HttpPut('')
    @Async()
    async getWorkloads(body: FetchWorkloadsView): Promise<WorkloadView> {
        await this.authenticationService.authenticatedUser(this.request);
        const legalOfficers = body.legalOfficerAddresses?.map((address) => ValidAccountId.polkadot(address)) || []
        return {
            workloads: await this.workloadService.workloadOf(legalOfficers),
        }
    }
}
