import { Entity, PrimaryColumn, Column, Repository } from "typeorm";
import { EmbeddableUserIdentity, UserIdentity, toUserIdentity } from "./useridentity.js";
import { EmbeddablePostalAddress, PostalAddress, toPostalAddress } from "./postaladdress.js";
import { injectable } from "inversify";
import { appDataSource } from "@logion/rest-api-core";
import { Moment } from "moment";
import { ValidAccountId } from "@logion/node-api";
import { v4 as uuid } from "uuid";
import { DB_SS58_PREFIX } from "./supportedaccountid.model.js";
import moment from "moment";

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

    getDescription(): SecretRecoveryRequestDescription {
        return {
            requesterIdentityLocId: this.requesterIdentityLocId || "",
            secretName: this.secretName || "",
            challenge: this.challenge || "",
            createdOn: moment(this.createdOn),
            userIdentity: toUserIdentity(this.userIdentity)!,
            userPostalAddress: toPostalAddress(this.userPostalAddress)!,
        }
    }
}

export interface SecretRecoveryRequestDescription {
    readonly requesterIdentityLocId: string,
    readonly secretName: string;
    readonly challenge: string;
    readonly userIdentity: UserIdentity;
    readonly userPostalAddress: PostalAddress;
    readonly createdOn: Moment,
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
}

export interface NewSecretRecoveryRequestParams extends SecretRecoveryRequestDescription {
    legalOfficerAddress: ValidAccountId;
}

@injectable()
export class SecretRecoveryRequestFactory {

    newSecretRecoveryRequest(params: NewSecretRecoveryRequestParams): SecretRecoveryRequestAggregateRoot {
        const root = new SecretRecoveryRequestAggregateRoot();
        root.id = uuid();
        root.requesterIdentityLocId = params.requesterIdentityLocId;
        root.legalOfficerAddress = params.legalOfficerAddress.getAddress(DB_SS58_PREFIX);
        root.secretName = params.secretName;
        root.challenge = params.challenge;
        root.userIdentity = EmbeddableUserIdentity.from(params.userIdentity);
        root.userPostalAddress = EmbeddablePostalAddress.from(params.userPostalAddress);
        root.createdOn = params.createdOn.toDate();
        return root;
    }
}
