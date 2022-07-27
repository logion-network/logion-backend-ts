import { Entity, Column, PrimaryColumn, Repository } from "typeorm";
import { injectable } from "inversify";
import { Moment } from "moment";
import { getDataSource } from "../orm";

@Entity("session")
export class SessionAggregateRoot {

    @PrimaryColumn({ length: 255, name: "user_address" })
    userAddress?: string;

    @Column({ name: "session_id", type: "uuid" })
    sessionId?: string;

    @Column("timestamp without time zone", { name: "created_on", nullable: true })
    createdOn?: Date;
}

@injectable()
export class SessionRepository {

    constructor() {
        this.repository = getDataSource().getRepository(SessionAggregateRoot);
    }

    readonly repository: Repository<SessionAggregateRoot>;

    async save(session: SessionAggregateRoot): Promise<void> {
        await this.repository.save(session);
    }

    async find(userAddress: string, sessionId: string): Promise<SessionAggregateRoot | null> {
        let builder = this.repository.createQueryBuilder("session");
        builder
            .where("session.user_address = :userAddress", { userAddress: userAddress })
            .andWhere("session.session_id = :sessionId", { sessionId: sessionId })
        return await builder.getOne();
    }

    async delete(session: SessionAggregateRoot): Promise<void> {
        await this.repository.delete(session.userAddress!);
    }
}

export interface NewSessionParameters {
    userAddress: string,
    sessionId: string,
    createdOn: Moment,
}

@injectable()
export class SessionFactory {

    newSession(params: NewSessionParameters): SessionAggregateRoot {
        const root = new SessionAggregateRoot();
        root.userAddress = params.userAddress;
        root.sessionId = params.sessionId;
        root.createdOn = params.createdOn.toDate();
        return root;
    }
}
