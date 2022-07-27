import { Entity, PrimaryColumn, Column, Repository } from "typeorm";
import { injectable } from 'inversify';
import { Moment } from 'moment';
import { UserIdentity } from "./useridentity";
import { Log } from "../util/Log";
import { badRequest } from "../controllers/errors";
import { getDataSource } from "../orm";

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

    @Column(() => LegalOfficerDecision, {prefix: ""})
    decision?: LegalOfficerDecision;

    @Column({ length: 255, name: "other_legal_officer_address" })
    otherLegalOfficerAddress?: string;

    setDescription(description: ProtectionRequestDescription): void {
        this.requesterAddress = description.requesterAddress;
        this.otherLegalOfficerAddress = description.otherLegalOfficerAddress;

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
            otherLegalOfficerAddress: this.otherLegalOfficerAddress || "",
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
        expectedStatuses?: ProtectionRequestStatus[],
        kind?: ProtectionRequestKind,
    }) {
        this.expectedRequesterAddress = builder.expectedRequesterAddress || null;
        this.expectedStatuses = builder.expectedStatuses || [];
        this.kind = builder.kind || 'ANY';
    }

    readonly expectedRequesterAddress: string | null;
    readonly kind: ProtectionRequestKind;
    readonly expectedStatuses: ProtectionRequestStatus[];
}

@injectable()
export class ProtectionRequestRepository {

    constructor() {
        this.repository = getDataSource().getRepository(ProtectionRequestAggregateRoot);
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

        if(specification.kind === 'RECOVERY') {
            where("request.is_recovery IS TRUE");
            where = (a: any, b?: any) => builder.andWhere(a, b);
        } else if(specification.kind === 'PROTECTION_ONLY') {
            where("request.is_recovery IS FALSE");
            where = (a: any, b?: any) => builder.andWhere(a, b);
        }

        if(specification.expectedStatuses.length > 0) {
            where("request.status IN (:...expectedStatuses)", {expectedStatuses: specification.expectedStatuses});
            where = (a: any, b?: any) => builder.andWhere(a, b);
        }

        return await builder.getMany();
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
