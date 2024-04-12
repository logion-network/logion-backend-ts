import { Entity, PrimaryColumn, Column, Repository, OneToMany, ManyToOne, JoinColumn } from "typeorm";
import { injectable } from "inversify";
import { appDataSource } from "@logion/rest-api-core";
import moment, { Moment } from "moment";
import { Child, saveChildren } from "./child.js";
import { ValidAccountId } from "@logion/node-api";
import { DB_SS58_PREFIX } from "./supportedaccountid.model.js";

export type VoteStatus = "PENDING" | "APPROVED" | "REJECTED";

@Entity("vote")
export class VoteAggregateRoot {

    @PrimaryColumn({ name: "vote_id", type: "bigint" })
    voteId?: string;

    @Column({ name: "loc_id", type: "uuid", unique: true })
    locId?: string;

    @Column("timestamp without time zone", { name: "created_on" })
    createdOn?: Date;

    @Column({ default: "PENDING" })
    status?: string;

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

    addBallot(voter: ValidAccountId, result: VoteResult) {
        const ballot = new Ballot();
        ballot.voteId = this.voteId;
        ballot.voterAddress = voter.getAddress(DB_SS58_PREFIX);
        ballot.result = result;
        ballot.vote = this;
        ballot._toAdd = true;
        this.ballots!.push(ballot);
    }

    close(approved: boolean) {
        if(this.status !== "PENDING") {
            throw new Error("Vote is already closed");
        }
        this.status = approved ? "APPROVED" : "REJECTED";
    }

    get typeSafeStatus(): VoteStatus {
        if(this.status === "PENDING" || this.status === "APPROVED" || this.status === "REJECTED") {
            return this.status;
        } else {
            throw new Error(`Unexpected status ${this.status}`);
        }
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

    getVoter(): ValidAccountId {
        return ValidAccountId.polkadot(this.voterAddress || "");
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
        return this.repository.findOneBy({ locId });
    }

    async findByVoteId(voteId: string): Promise<VoteAggregateRoot | null> {
        return this.repository.findOneBy({ voteId });
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
        root.status = "PENDING";
        root.ballots = [];
        return root;
    }
}
