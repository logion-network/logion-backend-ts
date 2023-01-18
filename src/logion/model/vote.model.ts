import { Entity, PrimaryColumn, Column, Repository, OneToMany, ManyToOne, JoinColumn } from "typeorm";
import { injectable } from "inversify";
import { appDataSource } from "@logion/rest-api-core";
import moment, { Moment } from "moment";
import { Child, saveChildren } from "./child.js";

@Entity("vote")
export class VoteAggregateRoot {

    @PrimaryColumn({ name: "vote_id", type: "bigint" })
    voteId?: string;

    @Column({ name: "loc_id", type: "uuid", unique: true })
    locId?: string;

    @Column("timestamp without time zone", { name: "created_on" })
    createdOn?: Date;

    @Column({ default: false })
    closed?: boolean;

    @OneToMany(() => Ballot, ballot => ballot.vote, {
        eager: true,
        cascade: false,
        persistence: false
    })
    ballots?: Ballot[];

    getDescription(): VoteDescription {
        return {
            voteId: this.voteId!,
            locId: this.locId!,
            createdOn: moment(this.createdOn),
        }
    }

    addBallot(voterAddress: string, result: VoteResult) {
        const ballot = new Ballot();
        ballot.voteId = this.voteId;
        ballot.voterAddress = voterAddress;
        ballot.result = result;
        ballot.vote = this;
        this.ballots!.push(ballot);
    }

    close() {
        if(this.closed) {
            throw new Error("Vote is already closed");
        }
        this.closed = true;
    }
}

export type VoteResult = "Yes" | "No";

@Entity("ballot")
export class Ballot extends Child {

    @PrimaryColumn({ name: "vote_id", type: "bigint" })
    voteId?: string;

    @PrimaryColumn("varchar", { name: "voter" })
    voterAddress?: string;

    @Column("varchar", { length: 10 })
    result?: string;

    @ManyToOne(() => VoteAggregateRoot, request => request.ballots)
    @JoinColumn({ name: "vote_id" })
    vote?: VoteAggregateRoot;
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

    async save(root: VoteAggregateRoot) {
        await this.repository.save(root);
        await saveChildren({
            children: root.ballots!,
            entityManager: this.repository.manager,
            entityClass: Ballot,
        });
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
        root.closed = false;
        root.ballots = [];
        return root;
    }
}
