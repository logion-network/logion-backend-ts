import { JsonArgs, JsonMethod } from "../../call";

export interface JsonExtrinsic {
    method: JsonMethod;
    signer: string | null;
    args: JsonArgs;
    tip: string | null;
    partialFee: () => Promise<string | undefined>;
    events: JsonEvent[];
    paysFee: boolean;
    error: () => ExtrinsicError | null;
}

export function toString(extrinsic: JsonExtrinsic, error: ExtrinsicError | null): string {
    return `extrinsic ${ methodToString(extrinsic.method) } ${ errorToString(error) }`
}

export function toStringWithoutError(extrinsic: JsonExtrinsic): string {
    return `extrinsic ${ methodToString(extrinsic.method) }`
}

export interface JsonEvent {
    method: JsonMethod;
    data: string[];
}

function methodToString(method: JsonMethod): string {
    return `method [${method.pallet}.${method.method}]`
}

export interface ExtrinsicError {
    section: string
    name: string
    details: string
}

function errorToString(error: ExtrinsicError | null): string {
    if (error) {
        return `error [${ error.section }.${ error.name }]`
    } else {
        return "";
    }
}
