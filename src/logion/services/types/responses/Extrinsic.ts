import { JsonArgs, JsonMethod } from "../../call";

export interface JsonExtrinsic {
    method: JsonMethod;
    signer: string | null;
    args: JsonArgs;
    tip: string | null;
    partialFee?: string;
    events: JsonEvent[];
    paysFee: boolean;
    error: ExtrinsicError | null;
}

export interface JsonEvent {
    method: JsonMethod;
    data: string[];
}

export interface ExtrinsicError {
    section: string
    name: string
    details: string
}
