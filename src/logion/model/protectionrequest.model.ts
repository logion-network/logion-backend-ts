import { Entity, PrimaryColumn, Column, Repository } from "typeorm";
import { injectable } from 'inversify';
import { Moment } from 'moment';
import { appDataSource, Log, badRequest } from "@logion/rest-api-core";

import { EmbeddableUserIdentity, toUserIdentity, UserIdentity } from "./useridentity";
import { EmbeddablePostalAddress, PostalAddress, toPostalAddress } from "./postaladdress";

const { logger } = Log;

export type ProtectionRequestStatus = 'PENDING' | 'REJECTED' | 'ACCEPTED' | 'ACTIVATED' | 'CANCELLED' | 'REJECTED_CANCELLED' | 'ACCEPTED_CANCELLED';

export type ProtectionRequestKind = 'RECOVERY' | 'PROTECTION_ONLY' | 'ANY';

export class LegalOfficerDecision {

    reject(reason: string, decisionOn: Moment): void {
        this.decisionOn = decisionOn.toISOString();
        this.rejectReason = reason;
    }

    accept(decisionOn: Moment, locId: string): void {
        this.decisionOn = decisionOn.toISOString();
        this.locId = locId;
    }

    clear() {
        this.decisionOn = undefined;
        this.rejectReason = undefined;
    }

    @Column("timestamp without time zone", { name: "decision_on", nullable: true })
    decisionOn?: string;

    @Column({ length: 255, name: "reject_reason", nullable: true })
    rejectReason?: string;

    @Column({ type: "uuid", nullable: true, name: "loc_id" })
    locId?: string;
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

    accept(decisionOn: Moment, locId: string): void {
        if(this.status !== 'PENDING') {
            throw badRequest("Request is not pending");
        }
        this.status = 'ACCEPTED';
        this.decision!.accept(decisionOn, locId);
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

    @Column(() => EmbeddableUserIdentity, { prefix: "" })
    userIdentity?: EmbeddableUserIdentity;

    @Column(() => EmbeddablePostalAddress, { prefix: "" })
    userPostalAddress?: EmbeddablePostalAddress;

    @Column({ length: 255 })
    status?: ProtectionRequestStatus;

    @Column(() => LegalOfficerDecision, {prefix: ""})
    decision?: LegalOfficerDecision;

    @Column({ length: 255, name: "legal_officer_address" })
    legalOfficerAddress?: string;

    @Column({ length: 255, name: "other_legal_officer_address" })
    otherLegalOfficerAddress?: string;

    setDescription(description: ProtectionRequestDescription): void {
        this.requesterAddress = description.requesterAddress;
        this.legalOfficerAddress = description.legalOfficerAddress;
        this.otherLegalOfficerAddress = description.otherLegalOfficerAddress;

        this.userIdentity = EmbeddableUserIdentity.from(description.userIdentity);
        this.userPostalAddress = EmbeddablePostalAddress.from(description.userPostalAddress);

        this.createdOn = description.createdOn;
        this.isRecovery = description.isRecovery;
        if(description.isRecovery) {
            this.addressToRecover = description.addressToRecover || undefined;
        }
    }

    getDescription(): ProtectionRequestDescription {
        return {
            requesterAddress: this.requesterAddress || "",
            legalOfficerAddress: this.legalOfficerAddress || "",
            otherLegalOfficerAddress: this.otherLegalOfficerAddress || "",
            userIdentity: toUserIdentity(this.userIdentity)!,
            userPostalAddress: toPostalAddress(this.userPostalAddress)!,
            createdOn: this.createdOn!,
            isRecovery: this.isRecovery!,
            addressToRecover: this.addressToRecover || null,
        };
    }

    getDecision(): LegalOfficerDecisionDescription | undefined {
        if (!this.decision || this.decision.decisionOn === undefined) {
            return undefined
        }
        const { decisionOn, locId, rejectReason} = this.decision
        return {
            decisionOn,
            rejectReason,
            locId
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
        let builder = this.repository.createQueryBuilder("request");

        let where = (a: any, b?: any) => builder.where(a, b);

        if(specification.expectedRequesterAddress !== null) {
            where("request.requester_address = :expectedRequesterAddress", {expectedRequesterAddress: specification.expectedRequesterAddress});
            where = (a: any, b?: any) => builder.andWhere(a, b);
        }

        if(specification.expectedLegalOfficerAddress !== null) {
            where("request.legal_officer_address = :expectedLegalOfficerAddress", {expectedLegalOfficerAddress: specification.expectedLegalOfficerAddress});
            where = (a: any, b?: any) => builder.andWhere(a, b);
        }

        if(specification.kind === 'RECOVERY') {
            where("request.is_recovery IS TRUE");
            where = (a: any, b?: any) => builder.andWhere(a, b);
        } else if(specification.kind === 'PROTECTION_ONLY') {
            where("request.is_recovery IS FALSE");
            where = (a: any, b?: any) => builder.andWhere(a, b);
        }

        if(specification.expectedStatuses.length > 0) {
            where("request.status IN (:...expectedStatuses)", {expectedStatuses: specification.expectedStatuses});
        }

        return await builder.getMany();
    }
}

export interface ProtectionRequestDescription {
    readonly requesterAddress: string,
    readonly legalOfficerAddress: string,
    readonly otherLegalOfficerAddress: string,
    readonly userIdentity: UserIdentity,
    readonly userPostalAddress: PostalAddress,
    readonly createdOn: string,
    readonly isRecovery: boolean,
    readonly addressToRecover: string | null,
}

export interface LegalOfficerDecisionDescription {
    readonly decisionOn: string;
    readonly rejectReason?: string;
    readonly locId?: string;
}

export interface NewProtectionRequestParameters {
    id: string;
    description: ProtectionRequestDescription;
}

@injectable()
export class ProtectionRequestFactory {

    public newProtectionRequest(params: NewProtectionRequestParameters): ProtectionRequestAggregateRoot {
        const root = new ProtectionRequestAggregateRoot();
        root.id = params.id;
        root.status = 'PENDING';
        root.decision = new LegalOfficerDecision();
        root.setDescription(params.description);
        return root;
    }
}
