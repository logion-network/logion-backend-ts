import { Entity, PrimaryColumn, Column, Repository } from "typeorm";
import { EmbeddableUserIdentity, UserIdentity, toUserIdentity } from "./useridentity.js";
import { EmbeddablePostalAddress, PostalAddress, toPostalAddress } from "./postaladdress.js";
import { injectable } from "inversify";
import { appDataSource, requireDefined } from "@logion/rest-api-core";
import { Moment } from "moment";
import { ValidAccountId } from "@logion/node-api";
import { DB_SS58_PREFIX } from "./supportedaccountid.model.js";
import moment from "moment";
import { LegalOfficerDecision, LegalOfficerDecisionDescription } from "./decision.js";

export type SecretRecoveryRequestStatus = 'PENDING' | 'REJECTED' | 'ACCEPTED';

@Entity("secret_recovery_request")
export class SecretRecoveryRequestAggregateRoot {

    @PrimaryColumn({ type: "uuid" })
    id?: string;

    @Column({ type: "uuid", name: "requester_identity_loc_id" })
    requesterIdentityLocId?: string;

    @Column({ length: 255, name: "legal_officer_address" })
    legalOfficerAddress?: string;

    @Column({ length: 255, name: "secret_name" })
    secretName?: string;

    @Column({ length: 255, name: "challenge" })
    challenge?: string;

    @Column(() => EmbeddableUserIdentity, { prefix: "" })
    userIdentity?: EmbeddableUserIdentity;

    @Column(() => EmbeddablePostalAddress, { prefix: "" })
    userPostalAddress?: EmbeddablePostalAddress;

    @Column("timestamp without time zone", { name: "created_on" })
    createdOn?: Date;

    @Column({ length: 255 })
    status?: SecretRecoveryRequestStatus;

    @Column(() => LegalOfficerDecision, {prefix: ""})
    decision?: LegalOfficerDecision;

    getDescription(): SecretRecoveryRequestDescription {
        return {
            id: requireDefined(this.id),
            requesterIdentityLocId: this.requesterIdentityLocId || "",
            secretName: this.secretName || "",
            challenge: this.challenge || "",
            createdOn: moment(this.createdOn),
            userIdentity: toUserIdentity(this.userIdentity)!,
            userPostalAddress: toPostalAddress(this.userPostalAddress)!,
            status: requireDefined(this.status),
        }
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
        this.decision!.accept(decisionOn);
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

export interface SecretRecoveryRequestDescription {
    readonly id: string;
    readonly requesterIdentityLocId: string;
    readonly secretName: string;
    readonly challenge: string;
    readonly userIdentity: UserIdentity;
    readonly userPostalAddress: PostalAddress;
    readonly createdOn: Moment;
    readonly status: SecretRecoveryRequestStatus;
}

@injectable()
export class SecretRecoveryRequestRepository {

    constructor() {
        this.repository = appDataSource.getRepository(SecretRecoveryRequestAggregateRoot);
    }

    readonly repository: Repository<SecretRecoveryRequestAggregateRoot>;

    async save(setting: SecretRecoveryRequestAggregateRoot): Promise<void> {
        await this.repository.save(setting);
    }

    async findByLegalOfficer(accountId: ValidAccountId): Promise<SecretRecoveryRequestAggregateRoot[]> {
        return this.repository.findBy({ legalOfficerAddress: accountId.getAddress(DB_SS58_PREFIX) });
    }

    async findById(id: string): Promise<SecretRecoveryRequestAggregateRoot | null> {
        return this.repository.findOneBy({ id });
    }
}

export interface NewSecretRecoveryRequestParams {
    readonly id: string;
    readonly requesterIdentityLocId: string;
    readonly secretName: string;
    readonly challenge: string;
    readonly userIdentity: UserIdentity;
    readonly userPostalAddress: PostalAddress;
    readonly createdOn: Moment;
    readonly legalOfficerAddress: ValidAccountId;
}

@injectable()
export class SecretRecoveryRequestFactory {

    newSecretRecoveryRequest(params: NewSecretRecoveryRequestParams): SecretRecoveryRequestAggregateRoot {
        const root = new SecretRecoveryRequestAggregateRoot();
        root.id = params.id;
        root.requesterIdentityLocId = params.requesterIdentityLocId;
        root.legalOfficerAddress = params.legalOfficerAddress.getAddress(DB_SS58_PREFIX);
        root.secretName = params.secretName;
        root.challenge = params.challenge;
        root.userIdentity = EmbeddableUserIdentity.from(params.userIdentity);
        root.userPostalAddress = EmbeddablePostalAddress.from(params.userPostalAddress);
        root.createdOn = params.createdOn.toDate();
        root.status = "PENDING";
        root.decision = new LegalOfficerDecision();
        return root;
    }
}
