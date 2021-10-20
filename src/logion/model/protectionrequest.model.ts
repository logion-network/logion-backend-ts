import { Entity, PrimaryColumn, Column, getRepository, Repository, OneToMany, ManyToOne, JoinColumn } from "typeorm";
import { injectable } from 'inversify';
import { Moment } from 'moment';
import { UserIdentity } from "./useridentity";

export type ProtectionRequestStatus = 'PENDING' | 'ACTIVATED';

export type LegalOfficerDecisionStatus = 'PENDING' | 'REJECTED' | 'ACCEPTED';

export type ProtectionRequestKind = 'RECOVERY' | 'PROTECTION_ONLY' | 'ANY';

@Entity("protection_request")
export class ProtectionRequestAggregateRoot {

    reject(legalOfficerAddress: string, reason: string, decisionOn: Moment): void {
        this._decisionOf(legalOfficerAddress).reject(reason, decisionOn);
    }

    private _decisionOf(legalOfficerAddress: string): LegalOfficerDecision {
        if(this.decisions === undefined) {
            throw new Error("Request has no decision");
        }
        for(let i = 0; i < this.decisions.length; ++i) {
            const decision = this.decisions[i];
            if(decision.legalOfficerAddress === legalOfficerAddress) {
                return decision;
            }
        }
        throw new Error("Request has no decision for legal officer " + legalOfficerAddress);
    }

    accept(legalOfficerAddress: string, decisionOn: Moment): void {
        this._decisionOf(legalOfficerAddress).accept(decisionOn);
    }

    setActivated() {
        this.status = 'ACTIVATED';
    }

    @PrimaryColumn({ type: "uuid" })
    id?: string;

    @Column("varchar", { name: "address_to_recover", length: 255, nullable: true })
    addressToRecover?: string | null;

    @Column("timestamp without time zone", { name: "created_on", nullable: true })
    createdOn?: string;

    @Column("boolean", {name: "is_recovery" })
    isRecovery?: boolean;

    @Column({ length: 255, name: "requester_address", unique: true })
    requesterAddress?: string;

    @Column({ length: 255 })
    email?: string;

    @Column({ length: 255, name: "first_name" })
    firstName?: string;

    @Column({ length: 255, name: "last_name" })
    lastName?: string;

    @Column({ length: 255, name: "phone_number" })
    phoneNumber?: string;

    @Column({ length: 255 })
    city?: string;

    @Column({ length: 255 })
    country?: string;

    @Column({ length: 255 })
    line1?: string;

    @Column({ length: 255, nullable: true })
    line2?: string;

    @Column({ length: 255, name: "postal_code" })
    postalCode?: string;

    @Column({ length: 255 })
    status?: ProtectionRequestStatus;

    @OneToMany(() => LegalOfficerDecision, decision => decision.request, {
        eager: true,
        cascade: true
    })
    decisions?: LegalOfficerDecision[];

    setDescription(description: ProtectionRequestDescription): void {
        this.requesterAddress = description.requesterAddress;

        this.firstName = description.userIdentity.firstName;
        this.lastName = description.userIdentity.lastName;
        this.email = description.userIdentity.email;
        this.phoneNumber = description.userIdentity.phoneNumber;

        this.line1 = description.userPostalAddress.line1;
        this.line2 = description.userPostalAddress.line2;
        this.city = description.userPostalAddress.city;
        this.postalCode = description.userPostalAddress.postalCode;
        this.country = description.userPostalAddress.country;

        this.createdOn = description.createdOn;
        this.isRecovery = description.isRecovery;
        if(description.isRecovery) {
            this.addressToRecover = description.addressToRecover || undefined;
        }
    }

    getDescription(): ProtectionRequestDescription {
        return {
            requesterAddress: this.requesterAddress || "",
            userIdentity: {
                firstName: this.firstName || "",
                lastName: this.lastName || "",
                email: this.email || "",
                phoneNumber: this.phoneNumber || "",
            },
            userPostalAddress: {
                line1: this.line1 || "",
                line2: this.line2 || "",
                postalCode: this.postalCode || "",
                city: this.city || "",
                country: this.country || "",
            },
            createdOn: this.createdOn!,
            isRecovery: this.isRecovery!,
            addressToRecover: this.addressToRecover || null,
        };
    }

    setPendingDecisions(legalOfficerAddresses: string[]): void {
        this.decisions = legalOfficerAddresses.map(setLegalOfficerDecisions => {
            const legalOfficerDecision = new LegalOfficerDecision();
            legalOfficerDecision.requestId = this.id;
            legalOfficerDecision.legalOfficerAddress = setLegalOfficerDecisions;
            legalOfficerDecision.request = this;

            legalOfficerDecision.status = 'PENDING';
            legalOfficerDecision.createdOn = this.createdOn;

            return legalOfficerDecision;
        });
    }
}

@Entity("legal_officer_decision")
export class LegalOfficerDecision {

    reject(reason: string, decisionOn: Moment): void {
        if(this.status !== 'PENDING') {
            throw new Error("Decision is not pending");
        }
        this.rejectReason = reason;
        this.decisionOn = decisionOn.toISOString();
        this.status = 'REJECTED';
    }

    accept(decisionOn: Moment): void {
        if(this.status !== 'PENDING') {
            throw new Error("Decision is not pending");
        }
        this.decisionOn = decisionOn.toISOString();
        this.status = 'ACCEPTED';
    }

    @PrimaryColumn({name: "request_id"})
    requestId?: string;

    @PrimaryColumn({name: "legal_officer_address"})
    legalOfficerAddress?: string;

    @Column("timestamp without time zone", { name: "created_on", nullable: true })
    createdOn?: string;

    @Column("timestamp without time zone", { name: "decision_on", nullable: true })
    decisionOn?: string;

    @Column({ length: 255, name: "reject_reason", nullable: true })
    rejectReason?: string;

    @Column({ length: 255 })
    status?: LegalOfficerDecisionStatus;

    @ManyToOne(() => ProtectionRequestAggregateRoot, request => request.decisions)
    @JoinColumn({ name: "request_id" })
    request?: ProtectionRequestAggregateRoot;
}

export class FetchProtectionRequestsSpecification {

    constructor(builder: {
        expectedRequesterAddress?: string,
        expectedLegalOfficer?: string,
        expectedDecisionStatuses?: LegalOfficerDecisionStatus[],
        expectedProtectionRequestStatus?: ProtectionRequestStatus,
        kind?: ProtectionRequestKind,
    }) {
        this.expectedRequesterAddress = builder.expectedRequesterAddress || null;
        this.expectedLegalOfficer = builder.expectedLegalOfficer || null;
        this.expectedDecisionStatuses = builder.expectedDecisionStatuses || [];
        this.expectedProtectionRequestStatus = builder.expectedProtectionRequestStatus || null;
        this.kind = builder.kind || 'ANY';
    }

    readonly expectedRequesterAddress: string | null;
    readonly expectedLegalOfficer: string | null;
    readonly expectedDecisionStatuses: LegalOfficerDecisionStatus[];
    readonly kind: ProtectionRequestKind;
    readonly expectedProtectionRequestStatus: ProtectionRequestStatus | null;
}

@injectable()
export class ProtectionRequestRepository {

    constructor() {
        this.repository = getRepository(ProtectionRequestAggregateRoot);
    }

    readonly repository: Repository<ProtectionRequestAggregateRoot>;

    public findById(id: string): Promise<ProtectionRequestAggregateRoot | undefined> {
        return this.repository.findOne(id);
    }

    public async save(root: ProtectionRequestAggregateRoot): Promise<void> {
        await this.repository.save(root);
    }

    public async findBy(specification: FetchProtectionRequestsSpecification): Promise<ProtectionRequestAggregateRoot[]> {
        let builder = this.repository.createQueryBuilder("request")
            .innerJoinAndSelect("request.decisions", "decision");

        let refetch = false;
        if(specification.expectedRequesterAddress !== null) {
            builder.where("request.requester_address = :expectedRequesterAddress", {expectedRequesterAddress: specification.expectedRequesterAddress});
        } else {
            refetch = true;
            builder.where("decision.legal_officer_address = :expectedLegalOfficer", {expectedLegalOfficer: specification.expectedLegalOfficer});
        }

        if(specification.kind === 'RECOVERY') {
            builder.andWhere("request.is_recovery IS TRUE");
        } else if(specification.kind === 'PROTECTION_ONLY') {
            builder.andWhere("request.is_recovery IS FALSE");
        }

        if(specification.expectedDecisionStatuses.length > 0) {
            refetch = true;
            builder.andWhere("decision.status IN (:...expectedDecisionStatuses)", {expectedDecisionStatuses: specification.expectedDecisionStatuses});
        }

        if(specification.expectedProtectionRequestStatus !== null) {
            builder.andWhere("request.status = :expectedProtectionRequestStatus", {expectedProtectionRequestStatus: specification.expectedProtectionRequestStatus});
        }

        const requests = await builder.getMany();
        if(refetch) {
            const promises = requests.map(request => this.repository.findOne(request.id!));
            return (await Promise.all(promises)).map(value => value!);
        } else {
            return requests;
        }
    }
}

export interface PostalAddress {
    line1: string,
    line2: string,
    postalCode: string,
    city: string,
    country: string,
}

export interface ProtectionRequestDescription {
    readonly requesterAddress: string,
    readonly userIdentity: UserIdentity,
    readonly userPostalAddress: PostalAddress,
    readonly createdOn: string,
    readonly isRecovery: boolean,
    readonly addressToRecover: string | null,
}

export interface NewProtectionRequestParameters {
    id: string;
    description: ProtectionRequestDescription;
    legalOfficerAddress: string;
}

@injectable()
export class ProtectionRequestFactory {

    public newProtectionRequest(params: NewProtectionRequestParameters): ProtectionRequestAggregateRoot {
        const root = new ProtectionRequestAggregateRoot();
        root.id = params.id;
        root.status = 'PENDING';

        root.setDescription(params.description);
        root.setPendingDecisions([params.legalOfficerAddress]);

        return root;
    }
}
