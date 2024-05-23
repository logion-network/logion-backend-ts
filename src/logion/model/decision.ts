import { Column } from "typeorm";
import { Moment } from 'moment';

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

export interface LegalOfficerDecisionDescription {
    readonly decisionOn: string;
    readonly rejectReason?: string;
}
