import { Log, badRequest } from "@logion/rest-api-core";
import { Column } from "typeorm";
import moment, { Moment } from "moment";

import { components } from "../controllers/components.js";
import { isTruthy } from "../lib/db/collections.js";

const { logger } = Log;

export class EmbeddableLifecycle {

    requestReview() {
        if (this.status !== "DRAFT") {
            throw badRequest(`Cannot request a review on item with status ${ this.status }`);
        }
        this.status = "REVIEW_PENDING";
    }

    accept() {
        if (this.status !== "REVIEW_PENDING") {
            throw badRequest(`Cannot accept an item with status ${ this.status }`);
        }
        this.status = "REVIEW_ACCEPTED";
        this.reviewedOn = moment().toDate();
    }

    reject(reason: string) {
        if (this.status !== "REVIEW_PENDING") {
            throw badRequest(`Cannot reject an item with status ${ this.status }`);
        }
        this.status = "REVIEW_REJECTED";
        this.rejectReason = reason;
        this.reviewedOn = moment().toDate();
    }

    prePublishOrAcknowledge(isAcknowledged: boolean, addedOn?: Moment) {
        const acknowledgedOrPublished = isAcknowledged ? "ACKNOWLEDGED" : "PUBLISHED";
        if (this.status !== "REVIEW_ACCEPTED" && this.status !== acknowledgedOrPublished) {
            throw badRequest(`Cannot pre-publish/-acknowledge item with status ${ this.status }`);
        }
        this.status = acknowledgedOrPublished;
        this.addedOn = addedOn?.toDate();
    }

    cancelPrePublishOrAcknowledge(isAcknowledged: boolean) {
        const acknowledgedOrPublished = isAcknowledged ? "ACKNOWLEDGED" : "PUBLISHED";
        if (this.status !== acknowledgedOrPublished) {
            throw badRequest(`Cannot cancel pre-publish/-acknowledge of item with status ${ this.status }`);
        }
        if(this.addedOn) {
            throw badRequest(`Cannot cancel, published/acknowledged`);
        }
        this.status = "REVIEW_ACCEPTED";
    }

    preAcknowledge(expectVerifiedIssuer: boolean, byVerifiedIssuer: boolean, acknowledgedOn?: Moment) {
        if (this.status !== "PUBLISHED" && this.status !== "ACKNOWLEDGED") {
            throw badRequest(`Cannot confirm-acknowledge item with status ${ this.status }`);
        }
        if(byVerifiedIssuer) {
            this.acknowledgedByVerifiedIssuer = true;
            this.acknowledgedByVerifiedIssuerOn = acknowledgedOn ? acknowledgedOn.toDate() : undefined;
        } else {
            this.acknowledgedByOwner = true;
            this.acknowledgedByOwnerOn = acknowledgedOn ? acknowledgedOn.toDate() : undefined;
        }
        if(
            (this.acknowledgedByOwner && this.acknowledgedByVerifiedIssuer)
            || (!expectVerifiedIssuer && this.acknowledgedByOwner)
        ) {
            this.status = "ACKNOWLEDGED";
        }
    }

    cancelPreAcknowledge(byVerifiedIssuer: boolean) {
        if (this.status !== "ACKNOWLEDGED") {
            throw badRequest(`Cannot confirm-acknowledge item with status ${ this.status }`);
        }
        if(this.acknowledgedByVerifiedIssuerOn || this.acknowledgedByOwnerOn) {
            throw badRequest(`Cannot cancel, acknowledged`);
        }
        if(byVerifiedIssuer) {
            this.acknowledgedByVerifiedIssuer = false;
        } else {
            this.acknowledgedByOwner = false;
        }
        if(this.status === "ACKNOWLEDGED") {
            this.status = "PUBLISHED";
        }
    }

    isAcknowledged(): boolean {
        return this.status === "ACKNOWLEDGED";
    }

    isAcknowledgedOnChain(expectVerifiedIssuer: boolean): boolean {
        return this.isAcknowledged() && (
            (expectVerifiedIssuer && isTruthy(this.acknowledgedByOwnerOn) && isTruthy(this.acknowledgedByVerifiedIssuerOn))
            || (!expectVerifiedIssuer && isTruthy(this.acknowledgedByOwnerOn))
        );
    }

    isPublished(): boolean {
        return this.status === "PUBLISHED";
    }

    isPublishedOnChain(): boolean {
        return this.isPublished() && isTruthy(this.addedOn);
    }

    setAddedOn(addedOn: Moment) {
        if (this.addedOn) {
            logger.warn("Item added on date is already set");
        }
        this.addedOn = addedOn.toDate();
        if(this.status === "REVIEW_ACCEPTED") {
            this.status = "PUBLISHED";
        }
    }

    getDescription(): ItemLifecycle {
        return {
            status: this.status!,
            rejectReason: this.status === "REVIEW_REJECTED" ? this.rejectReason! : undefined,
            reviewedOn: this.reviewedOn ? moment(this.reviewedOn) : undefined,
            addedOn: this.addedOn ? moment(this.addedOn) : undefined,
            acknowledgedByOwnerOn: this.acknowledgedByOwnerOn ? moment(this.acknowledgedByOwnerOn) : undefined,
            acknowledgedByVerifiedIssuerOn: this.acknowledgedByVerifiedIssuerOn ? moment(this.acknowledgedByVerifiedIssuerOn) : undefined,
        }
    }

    static fromSubmissionType(submissionType: SubmissionType) {
        const lifecycle = new EmbeddableLifecycle();
        lifecycle.status =
            submissionType === "DIRECT_BY_REQUESTER" ? "PUBLISHED" :
                submissionType === "MANUAL_BY_OWNER" ? "REVIEW_ACCEPTED" : "DRAFT";
        lifecycle.acknowledgedByOwner = submissionType === "MANUAL_BY_OWNER";
        lifecycle.acknowledgedByOwnerOn = submissionType === "MANUAL_BY_OWNER" ? moment().toDate() : undefined;
        lifecycle.acknowledgedByVerifiedIssuer = false;
        return lifecycle;
    }

    static default(status: ItemStatus  | undefined) {
        const lifecycle = new EmbeddableLifecycle();
        lifecycle.status = status;
        lifecycle.acknowledgedByOwner = false;
        lifecycle.acknowledgedByVerifiedIssuer = false;
        return lifecycle;
    }

    @Column("varchar", { length: 255 })
    status?: ItemStatus

    @Column("varchar", { length: 255, name: "reject_reason", nullable: true })
    rejectReason?: string | null;

    @Column("timestamp without time zone", { name: "reviewed_on", nullable: true })
    reviewedOn?: Date;

    @Column("timestamp without time zone", { name: "added_on", nullable: true })
    addedOn?: Date;

    @Column("timestamp without time zone", { name: "acknowledged_by_owner_on", nullable: true })
    acknowledgedByOwnerOn?: Date;

    @Column("boolean", { name: "acknowledged_by_owner", default: false })
    acknowledgedByOwner?: boolean;

    @Column("timestamp without time zone", { name: "acknowledged_by_verified_issuer_on", nullable: true })
    acknowledgedByVerifiedIssuerOn?: Date;

    @Column("boolean", { name: "acknowledged_by_verified_issuer", default: false })
    acknowledgedByVerifiedIssuer?: boolean;
}

export type ItemStatus = components["schemas"]["ItemStatus"];

export type SubmissionType = "MANUAL_BY_USER" | "MANUAL_BY_OWNER" | "DIRECT_BY_REQUESTER"; // "USER" can be Requester or VI.

export interface ItemLifecycle {
    readonly status: ItemStatus;
    readonly rejectReason?: string;
    readonly reviewedOn?: Moment;
    readonly addedOn?: Moment;
    readonly acknowledgedByOwnerOn?: Moment;
    readonly acknowledgedByVerifiedIssuerOn?: Moment;
}
