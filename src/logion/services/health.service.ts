import { injectable } from "inversify";
import { HealthService } from "@logion/rest-api-core";
import { SyncPointRepository, TRANSACTIONS_SYNC_POINT_NAME } from "../model/syncpoint.model";

@injectable()
export class BackendHealthService extends HealthService {

    constructor(
        private syncPointRepository: SyncPointRepository,
    ) {
        super();
    }

    async checkHealth(): Promise<void> {
        await this.syncPointRepository.findByName(TRANSACTIONS_SYNC_POINT_NAME);
    }
}
