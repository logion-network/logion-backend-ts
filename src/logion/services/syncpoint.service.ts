import { DefaultTransactional, requireDefined } from "@logion/rest-api-core";
import { injectable } from "inversify";
import { Moment } from "moment";
import { SyncPointAggregateRoot, SyncPointRepository } from "../model/syncpoint.model";

export abstract class SyncPointService {

    constructor(
        private syncPointRepository: SyncPointRepository,
    ) {}

    async add(syncPoint: SyncPointAggregateRoot) {
        await this.syncPointRepository.save(syncPoint);
    }

    async update(name: string, values: {
        blockNumber: bigint,
        updatedOn: Moment,
    }) {
        const syncPoint = requireDefined(await this.syncPointRepository.findByName(name));
        syncPoint.update(values);
        await this.syncPointRepository.save(syncPoint);
    }
}

@injectable()
export class NonTransactionnalSyncPointService extends SyncPointService {

}

@injectable()
export class TransactionalSyncPointService extends SyncPointService {

    @DefaultTransactional()
    override async add(syncPoint: SyncPointAggregateRoot) {
        return super.add(syncPoint);
    }

    @DefaultTransactional()
    override async update(name: string, values: {
        blockNumber: bigint,
        updatedOn: Moment,
    }) {
        return super.update(name, values);
    }
}
