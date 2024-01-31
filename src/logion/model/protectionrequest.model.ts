import { Entity, PrimaryColumn, Column, Repository, ObjectLiteral } from "typeorm";
import { injectable } from 'inversify';
import { Moment } from 'moment';
import { appDataSource, Log, badRequest, requireDefined } from "@logion/rest-api-core";
import { LocRequestRepository } from "./locrequest.model.js";

const { logger } = Log;

export type ProtectionRequestStatus = 'PENDING' | 'REJECTED' | 'ACCEPTED' | 'ACTIVATED' | 'CANCELLED' | 'REJECTED_CANCELLED' | 'ACCEPTED_CANCELLED';

export type ProtectionRequestKind = 'RECOVERY' | 'PROTECTION_ONLY' | 'ANY';

export class LegalOfficerDecision {

    reject(reason: string, decisionOn: Moment): void {
        this.decisionOn = decisionOn.toISOString();
        this.rejectReason = reason;
    }

    accept(decisionOn: Moment): void {
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

@Entity("protection_request")
export class ProtectionRequestAggregateRoot {

    reject(reason: string, decisionOn: Moment): void {
        if(this.status !== 'PENDING') {
            throw badRequest("Request is not pending");
        }
        this.status = 'REJECTED';
        this.decision!.reject(reason, decisionOn);
    }

    accept(decisionOn: Moment): void {
        if(this.status !== 'PENDING') {
            throw badRequest("Request is not pending");
        }
        this.status = 'ACCEPTED';
        this.decision!.accept(decisionOn);
    }

    setActivated() {
        if(this.status !== 'ACCEPTED') {
            logger.warn("Request is not accepted");
        }
        this.status = 'ACTIVATED';
    }

    resubmit() {
        if(this.status !== 'REJECTED') {
            throw badRequest("Request is not rejected")
        }
        this.status = "PENDING";
        this.decision!.clear();
    }

    cancel() {
        if(this.status === 'ACTIVATED') {
            throw badRequest("Cannot cancel an already activated protection");
        }
        if(this.status === 'PENDING') {
            this.status = 'CANCELLED';
        } else if (this.status === 'REJECTED') {
            this.status = 'REJECTED_CANCELLED';
        } else {
            this.status = 'ACCEPTED_CANCELLED';
        }
    }

    updateOtherLegalOfficer(address: string) {
        if(this.status === 'ACTIVATED') {
            throw badRequest("Cannot update the LO of an already activated protection")
        }
        if (this.isRecovery) {
            throw badRequest("Cannot update the LO of a recovery request")
        }
        this.otherLegalOfficerAddress = address;
    }

    @PrimaryColumn({ type: "uuid" })
    id?: string;

    @Column("varchar", { name: "address_to_recover", length: 255, nullable: true })
    addressToRecover?: string | null;

    @Column("timestamp without time zone", { name: "created_on", nullable: true })
    createdOn?: string;

    @Column("boolean", {name: "is_recovery" })
    isRecovery?: boolean;

    @Column({ length: 255, name: "requester_address" })
    requesterAddress?: string;

    // NOTE: As of 24-01-2024, the requester identity LOC is populated instead of userIdentity and userPostalAddress
    // Therefore, in a fully normalized model, requesterAddress field should not be populated anymore,
    // but rather fetched from linked identity LOC.
    // Given that many queries rely on this field, this denormalization is kept.
    @Column({ name: "requester_identity_loc_id", type: "uuid", nullable: false })
    requesterIdentityLocId?: string;

    @Column({ length: 255 })
    status?: ProtectionRequestStatus;

    @Column(() => LegalOfficerDecision, {prefix: ""})
    decision?: LegalOfficerDecision;

    @Column({ length: 255, name: "legal_officer_address" })
    legalOfficerAddress?: string;

    @Column({ length: 255, name: "other_legal_officer_address" })
    otherLegalOfficerAddress?: string;

    getDescription(): ProtectionRequestDescription {
        return {
            requesterAddress: this.requesterAddress || "",
            requesterIdentityLocId: this.requesterIdentityLocId || "",
            legalOfficerAddress: this.legalOfficerAddress || "",
            otherLegalOfficerAddress: this.otherLegalOfficerAddress || "",
            createdOn: this.createdOn!,
            isRecovery: this.isRecovery!,
            addressToRecover: this.addressToRecover || null,
        };
    }

    getDecision(): LegalOfficerDecisionDescription | undefined {
        if (!this.decision || this.decision.decisionOn === undefined) {
            return undefined
        }
        const { decisionOn, rejectReason } = this.decision
        return {
            decisionOn,
            rejectReason,
        }
    }
}

export class FetchProtectionRequestsSpecification {

    constructor(builder: {
        expectedRequesterAddress?: string,
        expectedLegalOfficerAddress?: string,
        expectedStatuses?: ProtectionRequestStatus[],
        kind?: ProtectionRequestKind,
    }) {
        this.expectedRequesterAddress = builder.expectedRequesterAddress || null;
        this.expectedLegalOfficerAddress = builder.expectedLegalOfficerAddress || null;
        this.expectedStatuses = builder.expectedStatuses || [];
        this.kind = builder.kind || 'ANY';
    }

    readonly expectedRequesterAddress: string | null;
    readonly expectedLegalOfficerAddress: string | null;
    readonly kind: ProtectionRequestKind;
    readonly expectedStatuses: ProtectionRequestStatus[];
}

@injectable()
export class ProtectionRequestRepository {

    constructor() {
        this.repository = appDataSource.getRepository(ProtectionRequestAggregateRoot);
    }

    readonly repository: Repository<ProtectionRequestAggregateRoot>;

    public findById(id: string): Promise<ProtectionRequestAggregateRoot | null> {
        return this.repository.findOneBy({ id });
    }

    public async save(root: ProtectionRequestAggregateRoot): Promise<void> {
        await this.repository.save(root);
    }

    public async findBy(specification: FetchProtectionRequestsSpecification): Promise<ProtectionRequestAggregateRoot[]> {
        const builder = this.repository.createQueryBuilder("request");

        let where = (a: string, b?: ObjectLiteral) => builder.where(a, b);

        if(specification.expectedRequesterAddress !== null) {
            where("request.requester_address = :expectedRequesterAddress", {expectedRequesterAddress: specification.expectedRequesterAddress});
            where = (a: string, b?: ObjectLiteral) => builder.andWhere(a, b);
        }

        if(specification.expectedLegalOfficerAddress !== null) {
            where("request.legal_officer_address = :expectedLegalOfficerAddress", {expectedLegalOfficerAddress: specification.expectedLegalOfficerAddress});
            where = (a: string, b?: ObjectLiteral) => builder.andWhere(a, b);
        }

        if(specification.kind === 'RECOVERY') {
            where("request.is_recovery IS TRUE");
            where = (a: string, b?: ObjectLiteral) => builder.andWhere(a, b);
        } else if(specification.kind === 'PROTECTION_ONLY') {
            where("request.is_recovery IS FALSE");
            where = (a: string, b?: ObjectLiteral) => builder.andWhere(a, b);
        }

        if(specification.expectedStatuses.length > 0) {
            where("request.status IN (:...expectedStatuses)", {expectedStatuses: specification.expectedStatuses});
        }

        return await builder.getMany();
    }
}

export interface ProtectionRequestDescription {
    readonly requesterAddress: string,
    readonly requesterIdentityLocId: string,
    readonly legalOfficerAddress: string,
    readonly otherLegalOfficerAddress: string,
    readonly createdOn: string,
    readonly isRecovery: boolean,
    readonly addressToRecover: string | null,
}

export interface LegalOfficerDecisionDescription {
    readonly decisionOn: string;
    readonly rejectReason?: string;
}

export interface NewProtectionRequestParameters {
    readonly id: string;
    readonly requesterAddress: string,
    readonly requesterIdentityLoc: string,
    readonly legalOfficerAddress: string,
    readonly otherLegalOfficerAddress: string,
    readonly createdOn: string,
    readonly isRecovery: boolean,
    readonly addressToRecover: string | null,
}

@injectable()
export class ProtectionRequestFactory {


    constructor(
        private locRequestRepository: LocRequestRepository
    ) {
    }

    public async newProtectionRequest(params: NewProtectionRequestParameters): Promise<ProtectionRequestAggregateRoot> {
        const identityLoc = requireDefined(
            await this.locRequestRepository.findById(params.requesterIdentityLoc),
            () => badRequest("Identity LOC not found")
        )
        identityLoc.isValidPolkadotIdentityLocOrThrow(params.requesterAddress, params.legalOfficerAddress);

        const root = new ProtectionRequestAggregateRoot();
        root.id = params.id;
        root.status = 'PENDING';
        root.decision = new LegalOfficerDecision();
        root.requesterAddress = params.requesterAddress;
        root.requesterIdentityLocId = identityLoc.id;
        root.legalOfficerAddress = params.legalOfficerAddress;
        root.otherLegalOfficerAddress = params.otherLegalOfficerAddress;
        root.createdOn = params.createdOn;
        root.isRecovery = params.isRecovery;
        if(root.isRecovery) {
            root.addressToRecover = requireDefined(
                params.addressToRecover,
                () => badRequest("Recovery requires an address to recover")
            );
        }
        return root;
    }
}
