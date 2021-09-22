import { Entity, PrimaryColumn, Column, getRepository, Repository } from "typeorm";
import { injectable } from 'inversify';
import { Moment } from 'moment';

export type TokenizationRequestStatus = "PENDING" | "REJECTED" | "ACCEPTED";

export interface TokenizationRequestDescription {
    readonly requestedTokenName: string;
    readonly legalOfficerAddress: string;
    readonly requesterAddress: string;
    readonly bars: number;
    readonly createdOn: string;
}

export interface AssetDescription {
    readonly assetId: string;
    readonly decimals: number;
}

export class EmbeddableAssetDescription {

    @Column("varchar", {name: "asset_id", nullable: true})
    assetId?: string | null;

    @Column("integer", {name: "decimals", nullable: true})
    decimals?: number | null;
}

@Entity("tokenization_request")
export class TokenizationRequestAggregateRoot {

    reject(reason: string, rejectedOn: Moment): void {
        if(this.status != 'PENDING') {
            throw new Error("Cannot reject non-pending request");
        }

        this.status = 'REJECTED';
        this.rejectReason = reason;
        this.decisionOn = rejectedOn.toISOString();
    }

    accept(decisionOn: Moment, sessionTokenHash: string): void {
        if(this.status != 'PENDING') {
            throw new Error("Cannot accept non-pending request");
        }

        this.status = 'ACCEPTED';
        this.decisionOn = decisionOn.toISOString();
        this.acceptSessionTokenHash = sessionTokenHash;
    }

    public getDescription(): TokenizationRequestDescription {
        return {
            legalOfficerAddress: this.legalOfficerAddress!,
            requesterAddress: this.requesterAddress!,
            requestedTokenName: this.requestedTokenName!,
            bars: this.bars!,
            createdOn: this.createdOn!
        };
    }

    @PrimaryColumn({ type: "uuid" })
    id?: string;

    @Column("varchar", { name: "requested_token_name", length: 255, nullable: true })
    requestedTokenName?: string | null;

    @Column("timestamp without time zone", { name: "created_on", nullable: true })
    createdOn?: string | null;

    @Column("timestamp without time zone", { name: "decision_on", nullable: true })
    decisionOn?: string | null;

    @Column("varchar", { length: 255, name: "reject_reason", nullable: true })
    rejectReason?: string | null;

    @Column({ length: 255, name: "requester_address" })
    requesterAddress?: string;

    @Column({ length: 255, name: "legal_officer_address" })
    legalOfficerAddress?: string;

    @Column("integer")
    bars?: number;

    @Column({ length: 255 })
    status?: TokenizationRequestStatus;

    setAssetDescription(sessionToken: string, description: AssetDescription) {
        if(this.acceptSessionTokenHash === undefined || this.acceptSessionTokenHash !== sessionToken) {
            throw new Error("Invalid session token");
        }

        this.acceptSessionTokenHash = undefined;
        this.assetDescription = new EmbeddableAssetDescription();
        this.assetDescription.assetId = description.assetId;
        this.assetDescription.decimals = description.decimals;
    }

    @Column(() => EmbeddableAssetDescription, {prefix: ""})
    assetDescription?: EmbeddableAssetDescription;

    getAssetDescription(): AssetDescription | undefined {
        if(this.assetDescription === undefined
            || (this.assetDescription.assetId === undefined || this.assetDescription.assetId === null)
            || (this.assetDescription.decimals === undefined || this.assetDescription.decimals === null)) {
            return undefined;
        } else {
            return {
                assetId: this.assetDescription.assetId!,
                decimals: this.assetDescription.decimals!
            };
        }
    }

    @Column("varchar", {name: "accept_session_token_hash", nullable: true})
    acceptSessionTokenHash?: string | null;
}

export interface FetchRequestsSpecification {

    readonly expectedRequesterAddress?: string;
    readonly expectedLegalOfficer?: string;
    readonly expectedStatus: TokenizationRequestStatus;
    readonly expectedTokenName?: string;
}

@injectable()
export class TokenizationRequestRepository {

    constructor() {
        this.repository = getRepository(TokenizationRequestAggregateRoot);
    }

    readonly repository: Repository<TokenizationRequestAggregateRoot>;

    public findById(id: string): Promise<TokenizationRequestAggregateRoot | undefined> {
        return this.repository.findOne(id);
    }

    public async save(root: TokenizationRequestAggregateRoot): Promise<void> {
        await this.repository.save(root);
    }

    public findBy(specification: FetchRequestsSpecification): Promise<TokenizationRequestAggregateRoot[]> {
        let builder = this.repository.createQueryBuilder("request");

        if(specification.expectedRequesterAddress !== undefined) {
            builder.where("request.requester_address = :expectedRequesterAddress", {expectedRequesterAddress: specification.expectedRequesterAddress});
        } else if(specification.expectedLegalOfficer !== undefined) {
            builder.where("request.legal_officer_address = :expectedLegalOfficer", {expectedLegalOfficer: specification.expectedLegalOfficer});
        }

        if(specification.expectedStatus !== undefined) {
            builder.andWhere("request.status = :expectedStatus", {expectedStatus: specification.expectedStatus});
        }

        if(specification.expectedTokenName !== undefined) {
            builder.andWhere("request.requested_token_name = :expectedTokenName", {expectedTokenName: specification.expectedTokenName});
        }

        return builder.getMany();
    }
}

export interface NewTokenizationRequestParameters {
    readonly id: string;
    readonly description: TokenizationRequestDescription;
}

@injectable()
export class TokenizationRequestFactory {

    public newPendingTokenizationRequest(params: NewTokenizationRequestParameters): TokenizationRequestAggregateRoot {
        const request = new TokenizationRequestAggregateRoot();
        request.id = params.id;
        request.status = "PENDING";
        request.requesterAddress = params.description.requesterAddress;
        request.legalOfficerAddress = params.description.legalOfficerAddress;
        request.requestedTokenName = params.description.requestedTokenName;
        request.bars = params.description.bars;
        request.createdOn = params.description.createdOn;
        return request;
    }
}
