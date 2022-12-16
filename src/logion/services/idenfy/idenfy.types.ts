export interface IdenfyVerificationSession {
    authToken: string;
    scanRef: string;
}

export type IdenfyVerificationStatus = "APPROVED" | "DENIED" | "SUSPECTED" | "EXPIRED";

export const IdenfyCallbackPayloadFileTypes = ['FRONT', 'BACK', 'FACE', 'FRONT_VIDEO', 'BACK_VIDEO', 'FACE_VIDEO'] as const;

export interface IdenfyCallbackPayload {
    clientId: string;
    status: {
        overall: IdenfyVerificationStatus;
    };
    final: boolean;
    fileUrls: {
        [K in typeof IdenfyCallbackPayloadFileTypes[number]]: string | null;
    };
}
