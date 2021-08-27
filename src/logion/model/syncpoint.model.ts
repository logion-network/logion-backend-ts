import { injectable } from 'inversify';
import { Moment } from 'moment';
import { Entity, PrimaryColumn, Column, getRepository, Repository } from "typeorm";

export const TRANSACTIONS_SYNC_POINT_NAME = "Transaction";

@Entity("sync_point")
export class SyncPointAggregateRoot {

    update(params: {
        blockNumber: bigint,
        updatedOn: Moment
    }) {
        this.latestHeadBlockNumber = params.blockNumber.toString();
        this.updatedOn = params.updatedOn.toDate();
    }

    @PrimaryColumn()
    name?: string;

    @Column("bigint", {name: "latest_head_block_number"})
    latestHeadBlockNumber?: string;

    @Column("timestamp without time zone", {name: "updated_on"})
    updatedOn?: Date;
}

@injectable()
export class SyncPointRepository {

    constructor() {
        this.repository = getRepository(SyncPointAggregateRoot);
    }

    readonly repository: Repository<SyncPointAggregateRoot>;

    async save(syncPoint: SyncPointAggregateRoot): Promise<void> {
        await this.repository.save(syncPoint);
    }

    async findByName(name: string): Promise<SyncPointAggregateRoot | undefined> {
        return await this.repository.findOne(name);
    }

    async delete(syncPoint: SyncPointAggregateRoot): Promise<void> {
        await this.repository.delete(syncPoint.name!);
    }
}

@injectable()
export class SyncPointFactory {

    newSyncPoint(params: {
        name: string,
        latestHeadBlockNumber: bigint,
        createdOn: Moment,
    }): SyncPointAggregateRoot {
        const { name, latestHeadBlockNumber, createdOn } = params;
        const root = new SyncPointAggregateRoot();
        root.name = name;
        root.latestHeadBlockNumber = latestHeadBlockNumber.toString();
        root.updatedOn = createdOn.toDate();
        return root;
    }
}
