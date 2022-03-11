import { Entity, PrimaryColumn, Column, getRepository, Repository, Unique } from "typeorm";
import { injectable } from 'inversify';
import { Moment } from 'moment';

export type VaultTransferRequestStatus = 'PENDING' | 'REJECTED' | 'ACCEPTED' | 'CANCELLED';

export class VaultTransferRequestDecision {

    reject(reason: string, decisionOn: Moment): void {
        this.decisionOn = decisionOn.toISOString();
        this.rejectReason = reason;
    }

    acceptOrCancel(decisionOn: Moment): void {
        this.decisionOn = decisionOn.toISOString();
    }

    @Column("timestamp without time zone", { name: "decision_on", nullable: true })
    decisionOn?: string;

    @Column({ length: 255, name: "reject_reason", nullable: true })
    rejectReason?: string;
}

const AMOUNT_PRECISION = 50;

@Entity("vault_transfer_request")
@Unique(["blockNumber", "extrinsicIndex"])
export class VaultTransferRequestAggregateRoot {

    setDescription(description: VaultTransferRequestDescription): void {
        this.id = description.id;
        this.requesterAddress = description.requesterAddress;
        this.createdOn = description.createdOn;
        this.destination = description.destination;
        this.amount = description.amount.toString();
        this.blockNumber = description.timepoint.blockNumber.toString();
        this.extrinsicIndex = description.timepoint.extrinsicIndex;
    }

    getDescription(): VaultTransferRequestDescription {
        return {
            id: this.id!,
            requesterAddress: this.requesterAddress!,
            createdOn: this.createdOn!,
            destination: this.destination!,
            amount: BigInt(this.amount || "0"),
            timepoint: {
                blockNumber: BigInt(this.blockNumber!),
                extrinsicIndex: this.extrinsicIndex!,
            }
        };
    }

    reject(reason: string, decisionOn: Moment): void {
        if(this.status !== 'PENDING') {
            throw new Error("Request is not pending");
        }
        this.status = 'REJECTED';
        this.decision!.reject(reason, decisionOn);
    }

    accept(decisionOn: Moment): void {
        if(this.status !== 'PENDING') {
            throw new Error("Request is not pending");
        }
        this.status = 'ACCEPTED';
        this.decision!.acceptOrCancel(decisionOn);
    }

    cancel(decisionOn: Moment): void {
        if(this.status !== 'PENDING') {
            throw new Error("Request is not pending");
        }
        this.status = 'CANCELLED';
        this.decision!.acceptOrCancel(decisionOn);
    }

    @PrimaryColumn({ type: "uuid" })
    id?: string;

    @Column("timestamp without time zone", { name: "created_on", nullable: true })
    createdOn?: string;

    @Column({ length: 255, name: "requester_address" })
    requesterAddress?: string;

    @Column({ length: 255, name: "destination" })
    destination?: string;

    @Column("numeric", { name: "amount", precision: AMOUNT_PRECISION })
    amount?: string;

    @Column("bigint", { name: "block_number" })
    blockNumber?: string;

    @Column("integer", { name: "extrinsic_index" })
    extrinsicIndex?: number;

    @Column({ length: 255 })
    status?: VaultTransferRequestStatus;

    @Column(() => VaultTransferRequestDecision, { prefix: "" })
    decision?: VaultTransferRequestDecision;
}

export class FetchVaultTransferRequestsSpecification {

    constructor(builder: {
        expectedRequesterAddress?: string,
        expectedStatuses?: VaultTransferRequestStatus[],
    }) {
        this.expectedRequesterAddress = builder.expectedRequesterAddress || null;
        this.expectedStatuses = builder.expectedStatuses || [];
    }

    readonly expectedRequesterAddress: string | null;
    readonly expectedStatuses: VaultTransferRequestStatus[];
}

@injectable()
export class VaultTransferRequestRepository {

    constructor() {
        this.repository = getRepository(VaultTransferRequestAggregateRoot);
    }

    readonly repository: Repository<VaultTransferRequestAggregateRoot>;

    public findById(id: string): Promise<VaultTransferRequestAggregateRoot | undefined> {
        return this.repository.findOne(id);
    }

    public async save(root: VaultTransferRequestAggregateRoot): Promise<void> {
        await this.repository.save(root);
    }

    public async findBy(specification: FetchVaultTransferRequestsSpecification): Promise<VaultTransferRequestAggregateRoot[]> {
        let builder = this.repository.createQueryBuilder("request");

        let where = (a: any, b?: any) => builder.where(a, b);

        if(specification.expectedRequesterAddress !== null) {
            where("request.requester_address = :expectedRequesterAddress", {expectedRequesterAddress: specification.expectedRequesterAddress});
            where = (a: any, b?: any) => builder.andWhere(a, b);
        }

        if(specification.expectedStatuses.length > 0) {
            where("request.status IN (:...expectedStatuses)", {expectedStatuses: specification.expectedStatuses});
            where = (a: any, b?: any) => builder.andWhere(a, b);
        }

        return await builder.getMany();
    }
}

export interface Timepoint {
    readonly blockNumber: bigint;
    readonly extrinsicIndex: number;
}

export interface VaultTransferRequestDescription {
    readonly id: string,
    readonly requesterAddress: string,
    readonly createdOn: string,
    readonly destination: string,
    readonly amount: bigint,
    readonly timepoint: Timepoint,
}

@injectable()
export class VaultTransferRequestFactory {

    public newVaultTransferRequest(description: VaultTransferRequestDescription): VaultTransferRequestAggregateRoot {
        const root = new VaultTransferRequestAggregateRoot();
        root.setDescription(description);
        root.status = 'PENDING';
        root.decision = new VaultTransferRequestDecision();
        return root;
    }
}
