import { injectable } from 'inversify';
import { ApiController, Controller, Async, HttpGet } from 'dinoloop';
import { OpenAPIV3 } from 'express-oas-generator';

import { addTag, setControllerTag, getDefaultResponses } from './doc';
import { AuthenticationService } from "../services/authentication.service";
import { SyncPointRepository, TRANSACTIONS_SYNC_POINT_NAME } from '../model/syncpoint.model';

export function fillInSpec(spec: OpenAPIV3.Document): void {
    const tagName = 'Health';
    addTag(spec, {
        name: tagName,
        description: "Health checks"
    });
    setControllerTag(spec, /^\/api\/health.*/, tagName);

    HealthController.healthCheck(spec);
}

@injectable()
@Controller('/health')
export class HealthController extends ApiController {

    constructor(
        private authenticationService: AuthenticationService,
        private syncPointRepository: SyncPointRepository,
    ) {
        super();
        this.healthCheckToken = process.env.HEALTH_TOKEN;
    }

    private readonly healthCheckToken: string | undefined;

    static healthCheck(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/health"].get!;
        operationObject.summary = "Tells the status of the backend";
        operationObject.description = "The request is authenticated with a token";
        operationObject.responses = getDefaultResponses();
    }

    @HttpGet('')
    @Async()
    async healthCheck() {
        this.authenticationService.ensureAuthorizationBearer(this.request, this.healthCheckToken);
        await this.syncPointRepository.findByName(TRANSACTIONS_SYNC_POINT_NAME);
    }
}
