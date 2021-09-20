import { Entity, PrimaryColumn, Column, getRepository, Repository } from "typeorm";
import { injectable } from "inversify";

export type LocRequestStatus = "REQUESTED" | "REJECTED" | "OPEN";

export interface LocRequestDescription {
    readonly requesterAddress: string;
    readonly ownerAddress: string;
    readonly description: string;
    readonly createdOn: string;
}

@Entity("loc_request")
export class LocRequestAggregateRoot {

    public getDescription(): LocRequestDescription {
        return {
            requesterAddress: this.requesterAddress!,
            ownerAddress: this.ownerAddress!,
            description: this.description!,
            createdOn: this.createdOn!
        }
    }

    @PrimaryColumn({ type: "uuid" })
    id?: string;

    @Column({ length: 255 })
    status?: LocRequestStatus;

    @Column({ length: 255, name: "requester_address" })
    requesterAddress?: string;

    @Column({ length: 255, name: "owner_address" })
    ownerAddress?: string;

    @Column({ length: 255, name: "description" })
    description?: string;

    @Column("timestamp without time zone", { name: "decision_on", nullable: true })
    decisionOn?: string | null;

    @Column("varchar", { length: 255, name: "reject_reason", nullable: true })
    rejectReason?: string | null;

    @Column("timestamp without time zone", { name: "created_on", nullable: true })
    createdOn?: string | null;
}

export interface FetchLocRequestsSpecification {

    readonly expectedRequesterAddress?: string;
    readonly expectedOwnerAddress?: string;
    readonly expectedStatuses: LocRequestStatus[];
}

@injectable()
export class LocRequestRepository {

    constructor() {
        this.repository = getRepository(LocRequestAggregateRoot);
    }

    readonly repository: Repository<LocRequestAggregateRoot>;

    public findById(id: string): Promise<LocRequestAggregateRoot | undefined> {
        return this.repository.findOne(id);
    }

    public async save(root: LocRequestAggregateRoot): Promise<void> {
        await this.repository.save(root);
    }

    public findBy(specification: FetchLocRequestsSpecification): Promise<LocRequestAggregateRoot[]> {
        let builder = this.repository.createQueryBuilder("request");

        if (specification.expectedRequesterAddress !== undefined) {
            builder.where("request.requester_address = :expectedRequesterAddress",
                { expectedRequesterAddress: specification.expectedRequesterAddress });
        } else if (specification.expectedOwnerAddress !== undefined) {
            builder.where("request.owner_address = :expectedOwnerAddress",
                { expectedOwnerAddress: specification.expectedOwnerAddress });
        }

        if (specification.expectedStatuses !== undefined) {
            builder.andWhere("request.status IN (:...expectedStatuses)",
                { expectedStatuses: specification.expectedStatuses });
        }

        return builder.getMany();
    }
}

export interface NewLocRequestParameters {
    readonly id: string;
    readonly description: LocRequestDescription;
}

@injectable()
export class LocRequestFactory {

    public newLocRequest(params: NewLocRequestParameters): LocRequestAggregateRoot {
        const request = new LocRequestAggregateRoot();
        request.id = params.id;
        request.status = "REQUESTED";
        request.requesterAddress = params.description.requesterAddress;
        request.ownerAddress = params.description.ownerAddress;
        request.description = params.description.description;
        request.createdOn = params.description.createdOn;
        return request;
    }
}

