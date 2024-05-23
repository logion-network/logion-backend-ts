import { Entity, PrimaryColumn, Column, Repository, ObjectLiteral } from "typeorm";
import { injectable } from 'inversify';
import { Moment } from 'moment';
import { appDataSource, Log, badRequest, requireDefined } from "@logion/rest-api-core";
import { LocRequestRepository } from "./locrequest.model.js";
import { ValidAccountId } from "@logion/node-api";
import { DB_SS58_PREFIX } from "./supportedaccountid.model.js";
import { LegalOfficerDecision, LegalOfficerDecisionDescription } from "./decision.js";

const { logger } = Log;

export type ProtectionRequestStatus = 'PENDING' | 'REJECTED' | 'ACCEPTED' | 'ACTIVATED' | 'CANCELLED' | 'REJECTED_CANCELLED' | 'ACCEPTED_CANCELLED';

export type ProtectionRequestKind = 'RECOVERY' | 'PROTECTION_ONLY' | 'ANY';

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

    updateOtherLegalOfficer(account: ValidAccountId) {
        if(this.status === 'ACTIVATED') {
            throw badRequest("Cannot update the LO of an already activated protection")
        }
        if (this.isRecovery) {
            throw badRequest("Cannot update the LO of a recovery request")
        }
        this.otherLegalOfficerAddress = account.getAddress(DB_SS58_PREFIX);
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
            id: requireDefined(this.id),
            status: requireDefined(this.status),
            requesterAddress: ValidAccountId.polkadot(this.requesterAddress || ""),
            requesterIdentityLocId: this.requesterIdentityLocId || "",
            legalOfficerAddress: ValidAccountId.polkadot(this.legalOfficerAddress || ""),
            otherLegalOfficerAddress: ValidAccountId.polkadot(this.otherLegalOfficerAddress || ""),
            createdOn: requireDefined(this.createdOn),
            isRecovery: requireDefined(this.isRecovery),
            addressToRecover: this.addressToRecover ? ValidAccountId.polkadot(this.addressToRecover) : null,
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

    getLegalOfficer(): ValidAccountId {
        return ValidAccountId.polkadot(this.legalOfficerAddress || "")
    }

    getOtherLegalOfficer(): ValidAccountId {
        return ValidAccountId.polkadot(this.otherLegalOfficerAddress || "")
    }

    getRequester(): ValidAccountId {
        return ValidAccountId.polkadot(this.requesterAddress || "")
    }

    getAddressToRecover(): ValidAccountId | null {
        if (this.addressToRecover !== undefined && this.addressToRecover !== null) {
            return ValidAccountId.polkadot(this.addressToRecover)
        } else {
            return null;
        }
    }
}

export class FetchProtectionRequestsSpecification {

    constructor(builder: {
        expectedRequesterAddress?: ValidAccountId,
        expectedLegalOfficerAddress?: ValidAccountId[],
        expectedStatuses?: ProtectionRequestStatus[],
        kind?: ProtectionRequestKind,
    }) {
        this.expectedRequesterAddress = builder.expectedRequesterAddress || null;
        this.expectedLegalOfficerAddress = builder.expectedLegalOfficerAddress || null;
        this.expectedStatuses = builder.expectedStatuses || [];
        this.kind = builder.kind || 'ANY';
    }

    readonly expectedRequesterAddress: ValidAccountId | null;
    readonly expectedLegalOfficerAddress: ValidAccountId[] | null;
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
    readonly id: string,
    readonly status: ProtectionRequestStatus,
    readonly requesterAddress: ValidAccountId,
    readonly requesterIdentityLocId: string,
    readonly legalOfficerAddress: ValidAccountId,
    readonly otherLegalOfficerAddress: ValidAccountId,
    readonly createdOn: string,
    readonly isRecovery: boolean,
    readonly addressToRecover: ValidAccountId | null,
}

export interface NewProtectionRequestParameters {
    readonly id: string;
    readonly requesterAddress: ValidAccountId,
    readonly requesterIdentityLoc: string,
    readonly legalOfficerAddress: ValidAccountId,
    readonly otherLegalOfficerAddress: ValidAccountId,
    readonly createdOn: string,
    readonly isRecovery: boolean,
    readonly addressToRecover: ValidAccountId | null,
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
        root.requesterAddress = params.requesterAddress.getAddress(DB_SS58_PREFIX);
        root.requesterIdentityLocId = identityLoc.id;
        root.legalOfficerAddress = params.legalOfficerAddress.getAddress(DB_SS58_PREFIX);
        root.otherLegalOfficerAddress = params.otherLegalOfficerAddress.getAddress(DB_SS58_PREFIX);
        root.createdOn = params.createdOn;
        root.isRecovery = params.isRecovery;
        if(root.isRecovery) {
            root.addressToRecover = requireDefined(
                params.addressToRecover?.getAddress(DB_SS58_PREFIX),
                () => badRequest("Recovery requires an address to recover")
            );
        }
        return root;
    }
}
