import { Column } from "typeorm";

import { IdenfyVerificationStatus } from "../services/idenfy/idenfy.types";

export type EmbeddableIdenfyVerificationStatus = 'PENDING' | IdenfyVerificationStatus;

export class EmbeddableIdenfyVerification {

    @Column("varchar", { name: "idenfy_auth_token", length: 40, nullable: true })
    authToken?: string | null;

    @Column("varchar", { name: "idenfy_scan_ref", length: 40, nullable: true })
    scanRef?: string | null;

    @Column("varchar", { name: "idenfy_status", length: 255, nullable: true })
    status?: EmbeddableIdenfyVerificationStatus | null;

    @Column("text", { name: "idenfy_callback_payload", nullable: true })
    callbackPayload?: string | null;
}
