import { Entity, PrimaryColumn, Column, Repository, ObjectLiteral } from "typeorm";
import { injectable } from 'inversify';
import { Moment } from 'moment';
import { appDataSource, Log, badRequest, requireDefined } from "@logion/rest-api-core";
import { LocRequestRepository } from "./locrequest.model.js";
import { ValidAccountId } from "@logion/node-api";
import { DB_SS58_PREFIX } from "./supportedaccountid.model.js";
import { LegalOfficerDecision, LegalOfficerDecisionDescription } from "./decision.js";

const { logger } = Log;

export type AccountRecoveryRequestStatus = 'PENDING' | 'REJECTED' | 'ACCEPTED' | 'ACTIVATED' | 'CANCELLED' | 'REJECTED_CANCELLED' | 'ACCEPTED_CANCELLED';

@Entity("account_recovery_request")
export class AccountRecoveryRequestAggregateRoot {

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

    cancel() {
        if(this.status === 'ACTIVATED') {
            throw badRequest("Cannot cancel when already activated");
        }
        if(this.status === 'PENDING') {
            this.status = 'CANCELLED';
        } else if (this.status === 'REJECTED') {
            this.status = 'REJECTED_CANCELLED';
        } else {
            this.status = 'ACCEPTED_CANCELLED';
        }
    }

    @PrimaryColumn({ type: "uuid" })
    id?: string;

    @Column("varchar", { name: "address_to_recover", length: 255, nullable: true })
    addressToRecover?: string | null;

    @Column("timestamp without time zone", { name: "created_on", nullable: true })
    createdOn?: string;

    @Column({ length: 255, name: "requester_address" })
    requesterAddress?: string;

    // NOTE: As of 24-01-2024, the requester identity LOC is populated instead of userIdentity and userPostalAddress
    // Therefore, in a fully normalized model, requesterAddress field should not be populated anymore,
    // but rather fetched from linked identity LOC.
    // Given that many queries rely on this field, this denormalization is kept.
    @Column({ name: "requester_identity_loc_id", type: "uuid", nullable: false })
    requesterIdentityLocId?: string;

    @Column({ length: 255 })
    status?: AccountRecoveryRequestStatus;

    @Column(() => LegalOfficerDecision, {prefix: ""})
    decision?: LegalOfficerDecision;

    @Column({ length: 255, name: "legal_officer_address" })
    legalOfficerAddress?: string;

    @Column({ length: 255, name: "other_legal_officer_address" })
    otherLegalOfficerAddress?: string;

    getDescription(): AccountRecoveryRequestDescription {
        return {
            id: requireDefined(this.id),
            status: requireDefined(this.status),
            requesterAddress: ValidAccountId.polkadot(this.requesterAddress || ""),
            requesterIdentityLocId: this.requesterIdentityLocId || "",
            legalOfficerAddress: ValidAccountId.polkadot(this.legalOfficerAddress || ""),
            otherLegalOfficerAddress: ValidAccountId.polkadot(this.otherLegalOfficerAddress || ""),
            createdOn: requireDefined(this.createdOn),
            addressToRecover: ValidAccountId.polkadot(requireDefined(this.addressToRecover)),
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

    getAddressToRecover(): ValidAccountId {
        if (this.addressToRecover !== undefined && this.addressToRecover !== null) {
            return ValidAccountId.polkadot(this.addressToRecover)
        } else {
            throw new Error("No address to recover");
        }
    }
}

export class FetchAccountRecoveryRequestsSpecification {

    constructor(builder: {
        expectedRequesterAddress?: ValidAccountId,
        expectedLegalOfficerAddress?: ValidAccountId[],
        expectedStatuses?: AccountRecoveryRequestStatus[],
    }) {
        this.expectedRequesterAddress = builder.expectedRequesterAddress || null;
        this.expectedLegalOfficerAddress = builder.expectedLegalOfficerAddress || null;
        this.expectedStatuses = builder.expectedStatuses || [];
    }

    readonly expectedRequesterAddress: ValidAccountId | null;
    readonly expectedLegalOfficerAddress: ValidAccountId[] | null;
    readonly expectedStatuses: AccountRecoveryRequestStatus[];
}

@injectable()
export class AccountRecoveryRepository {

    constructor() {
        this.repository = appDataSource.getRepository(AccountRecoveryRequestAggregateRoot);
    }

    readonly repository: Repository<AccountRecoveryRequestAggregateRoot>;

    public findById(id: string): Promise<AccountRecoveryRequestAggregateRoot | null> {
        return this.repository.findOneBy({ id });
    }

    public async save(root: AccountRecoveryRequestAggregateRoot): Promise<void> {
        await this.repository.save(root);
    }

    public async findBy(specification: FetchAccountRecoveryRequestsSpecification): Promise<AccountRecoveryRequestAggregateRoot[]> {
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

export interface AccountRecoveryRequestDescription {
    readonly id: string,
    readonly status: AccountRecoveryRequestStatus,
    readonly requesterAddress: ValidAccountId,
    readonly requesterIdentityLocId: string,
    readonly legalOfficerAddress: ValidAccountId,
    readonly otherLegalOfficerAddress: ValidAccountId,
    readonly createdOn: string,
    readonly addressToRecover: ValidAccountId,
}

export interface NewAccountRecoveryRequestParameters {
    readonly id: string;
    readonly requesterAddress: ValidAccountId,
    readonly requesterIdentityLoc: string,
    readonly legalOfficerAddress: ValidAccountId,
    readonly otherLegalOfficerAddress: ValidAccountId,
    readonly createdOn: string,
    readonly addressToRecover: ValidAccountId,
}

@injectable()
export class AccountRecoveryRequestFactory {


    constructor(
        private locRequestRepository: LocRequestRepository
    ) {
    }

    public async newAccountRecoveryRequest(params: NewAccountRecoveryRequestParameters): Promise<AccountRecoveryRequestAggregateRoot> {
        const identityLoc = requireDefined(
            await this.locRequestRepository.findById(params.requesterIdentityLoc),
            () => badRequest("Identity LOC not found")
        )
        identityLoc.isValidPolkadotIdentityLocOrThrow(params.requesterAddress, params.legalOfficerAddress);

        const root = new AccountRecoveryRequestAggregateRoot();
        root.id = params.id;
        root.status = 'PENDING';
        root.decision = new LegalOfficerDecision();
        root.requesterAddress = params.requesterAddress.getAddress(DB_SS58_PREFIX);
        root.requesterIdentityLocId = identityLoc.id;
        root.legalOfficerAddress = params.legalOfficerAddress.getAddress(DB_SS58_PREFIX);
        root.otherLegalOfficerAddress = params.otherLegalOfficerAddress.getAddress(DB_SS58_PREFIX);
        root.createdOn = params.createdOn;
        root.addressToRecover = requireDefined(
            params.addressToRecover?.getAddress(DB_SS58_PREFIX),
            () => badRequest("Recovery requires an address to recover")
        );
        return root;
    }
}
