import { Entity, PrimaryColumn, Column, Repository } from "typeorm";
import { injectable } from "inversify";
import { appDataSource } from "@logion/rest-api-core";
import moment, { Moment } from "moment";

@Entity("vote")
export class VoteAggregateRoot {

    @PrimaryColumn({ name: "vote_id", type: "bigint" })
    voteId?: string;

    @Column({ name: "loc_id", type: "uuid", unique: true })
    locId?: string;

    @Column("timestamp without time zone", { name: "created_on" })
    createdOn?: Date;

    getDescription(): VoteDescription {
        return {
            voteId: this.voteId!,
            locId: this.locId!,
            createdOn: moment(this.createdOn),
        }
    }
}

@injectable()
export class VoteRepository {

    readonly repository: Repository<VoteAggregateRoot>;

    constructor() {
        this.repository = appDataSource.getRepository(VoteAggregateRoot);
    }

    async findAll(): Promise<VoteAggregateRoot[]> {
        return this.repository.find();
    }

    async findByLocId(locId: string): Promise<VoteAggregateRoot | null> {
        return this.repository.findOneBy({ locId })
    }
}

export interface VoteDescription {
    voteId: string;
    locId: string;
    createdOn: Moment;
}

@injectable()
export class VoteFactory {

    newVote(params: VoteDescription): VoteAggregateRoot {
        const { voteId, locId, createdOn } = params;
        const root = new VoteAggregateRoot();
        root.voteId = voteId;
        root.locId = locId;
        root.createdOn = createdOn.toDate();
        return root;
    }
}
