import { Entity, PrimaryColumn, Column, Repository, Unique, ObjectLiteral } from "typeorm";
import { injectable } from 'inversify';
import { Moment } from 'moment';
import { appDataSource } from "@logion/rest-api-core";
import { ValidAccountId } from "@logion/node-api";
import { DB_SS58_PREFIX } from "./supportedaccountid.model.js";

export type VaultTransferRequestStatus = 'PENDING' | 'REJECTED' | 'ACCEPTED' | 'CANCELLED' | 'REJECTED_CANCELLED';

export class VaultTransferRequestDecision {

    reject(reason: string, decisionOn: Moment): void {
        this.decisionOn = decisionOn.toISOString();
        this.rejectReason = reason;
    }

    acceptOrCancel(decisionOn: Moment): void {
        this.decisionOn = decisionOn.toISOString();
    }

    clear() {
        this.decisionOn = undefined;
        this.rejectReason = undefined;
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
        this.requesterAddress = description.requesterAddress.getAddress(DB_SS58_PREFIX);
        this.legalOfficerAddress = description.legalOfficerAddress.getAddress(DB_SS58_PREFIX);
        this.createdOn = description.createdOn;
        this.origin = description.origin.getAddress(DB_SS58_PREFIX);
        this.destination = description.destination.getAddress(DB_SS58_PREFIX);
        this.amount = description.amount.toString();
        this.blockNumber = description.timepoint.blockNumber.toString();
        this.extrinsicIndex = description.timepoint.extrinsicIndex;
    }

    getDescription(): VaultTransferRequestDescription {
        return {
            id: this.id!,
            requesterAddress: this.getRequester(),
            legalOfficerAddress: this.getLegalOfficer(),
            createdOn: this.createdOn!,
            origin: this.getOrigin(),
            destination: this.getDestination(),
            amount: BigInt(this.amount || "0"),
            timepoint: {
                blockNumber: BigInt(this.blockNumber!),
                extrinsicIndex: this.extrinsicIndex!,
            },
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
        if(this.status !== 'PENDING' && this.status !== 'REJECTED') {
            throw new Error("Request is not pending or rejected");
        }
        if(this.status === 'PENDING') {
            this.status = 'CANCELLED';
        } else {
            this.status = 'REJECTED_CANCELLED';
        }
        this.decision!.acceptOrCancel(decisionOn);
    }

    resubmit(): void {
        if(this.status !== 'REJECTED') {
            throw new Error("Request is not rejected");
        }
        this.status = "PENDING";
        this.decision!.clear();
    }

    @PrimaryColumn({ type: "uuid" })
    id?: string;

    @Column("timestamp without time zone", { name: "created_on", nullable: true })
    createdOn?: string;

    @Column({ length: 255, name: "requester_address" })
    requesterAddress?: string;

    @Column({ length: 255, name: "legal_officer_address" })
    legalOfficerAddress?: string;

    @Column({ length: 255, name: "origin" })
    origin?: string;

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

    getRequester(): ValidAccountId {
        return ValidAccountId.polkadot(this.requesterAddress || "")
    }

    getLegalOfficer(): ValidAccountId {
        return ValidAccountId.polkadot(this.legalOfficerAddress || "")
    }

    getOrigin(): ValidAccountId {
        return ValidAccountId.polkadot(this.origin || "")
    }

    getDestination(): ValidAccountId {
        return ValidAccountId.polkadot(this.destination || "")
    }
}

export class FetchVaultTransferRequestsSpecification {

    constructor(builder: {
        expectedRequesterAddress?: ValidAccountId,
        expectedLegalOfficerAddress?: ValidAccountId[],
        expectedStatuses?: VaultTransferRequestStatus[],
    }) {
        this.expectedRequesterAddress = builder.expectedRequesterAddress || null;
        this.expectedLegalOfficerAddress = builder.expectedLegalOfficerAddress || null;
        this.expectedStatuses = builder.expectedStatuses || [];
    }

    readonly expectedRequesterAddress: ValidAccountId | null;
    readonly expectedLegalOfficerAddress: ValidAccountId[] | null;
    readonly expectedStatuses: VaultTransferRequestStatus[];
}

@injectable()
export class VaultTransferRequestRepository {

    constructor() {
        this.repository = appDataSource.getRepository(VaultTransferRequestAggregateRoot);
    }

    readonly repository: Repository<VaultTransferRequestAggregateRoot>;

    public findById(id: string): Promise<VaultTransferRequestAggregateRoot | null> {
        return this.repository.findOneBy({ id });
    }

    public async save(root: VaultTransferRequestAggregateRoot): Promise<void> {
        await this.repository.save(root);
    }

    public async findBy(specification: FetchVaultTransferRequestsSpecification): Promise<VaultTransferRequestAggregateRoot[]> {
        const builder = this.repository.createQueryBuilder("request");

        let where = (a: string, b?: ObjectLiteral) => builder.where(a, b);

        if (specification.expectedRequesterAddress !== null) {
            where("request.requester_address = :expectedRequesterAddress",
                { expectedRequesterAddress: specification.expectedRequesterAddress.getAddress(DB_SS58_PREFIX) }
            );
            where = (a: string, b?: ObjectLiteral) => builder.andWhere(a, b);
        }

        if (specification.expectedLegalOfficerAddress !== null) {
            if (specification.expectedLegalOfficerAddress.length === 1) {
                where("request.legal_officer_address = :expectedLegalOfficerAddress",
                    { expectedLegalOfficerAddress: specification.expectedLegalOfficerAddress[0].getAddress(DB_SS58_PREFIX) }
                );
            } else {
                where("request.legal_officer_address IN (:...expectedLegalOfficerAddresses)",
                    { expectedLegalOfficerAddresses: specification.expectedLegalOfficerAddress.map(account => account.getAddress(DB_SS58_PREFIX)) }
                );
            }
            where = (a: string, b?: ObjectLiteral) => builder.andWhere(a, b);
        }

        if(specification.expectedStatuses.length > 0) {
            where("request.status IN (:...expectedStatuses)", {expectedStatuses: specification.expectedStatuses});
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
    readonly requesterAddress: ValidAccountId,
    readonly legalOfficerAddress: ValidAccountId,
    readonly createdOn: string,
    readonly origin: ValidAccountId,
    readonly destination: ValidAccountId,
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
