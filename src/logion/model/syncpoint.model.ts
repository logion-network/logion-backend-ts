import { injectable } from 'inversify';
import { Moment } from 'moment';
import { Entity, PrimaryColumn, Column, Repository } from "typeorm";
import { appDataSource } from "@logion/rest-api-core";
import { Block, EmbeddableBlock } from './block.model.js';

export const TRANSACTIONS_SYNC_POINT_NAME = "Transaction";

@Entity("sync_point")
export class SyncPointAggregateRoot {

    update(params: {
        block: Block,
        updatedOn: Moment
    }) {
        this.block = EmbeddableBlock.from(params.block);
        this.updatedOn = params.updatedOn.toDate();
    }

    @PrimaryColumn()
    name?: string;

    @Column(() => EmbeddableBlock, { prefix: "" })
    block?: EmbeddableBlock;

    @Column("timestamp without time zone", {name: "updated_on"})
    updatedOn?: Date;
}

@injectable()
export class SyncPointRepository {

    constructor() {
        this.repository = appDataSource.getRepository(SyncPointAggregateRoot);
    }

    readonly repository: Repository<SyncPointAggregateRoot>;

    async save(syncPoint: SyncPointAggregateRoot): Promise<void> {
        await this.repository.save(syncPoint);
    }

    async findByName(name: string): Promise<SyncPointAggregateRoot | null> {
        return await this.repository.findOneBy({ name });
    }
}

@injectable()
export class SyncPointFactory {

    newSyncPoint(params: {
        name: string,
        block: Block,
        createdOn: Moment,
    }): SyncPointAggregateRoot {
        const { name, block, createdOn } = params;
        const root = new SyncPointAggregateRoot();
        root.name = name;
        root.block = EmbeddableBlock.from(block);
        root.updatedOn = createdOn.toDate();
        return root;
    }
}
