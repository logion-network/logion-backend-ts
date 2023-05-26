import { TypesJsonCall, TypesJsonObject, UUID, Adapters } from "@logion/node-api";

export interface StorageFee {
    fee: bigint;
    withdrawnFrom: string;
}

export interface LegalFee {
    fee: bigint;
    withdrawnFrom: string;
    beneficiary: string;
}

export interface JsonExtrinsic {
    call: TypesJsonCall;
    signer: string | null;
    tip: string | null;
    partialFee: () => Promise<string | undefined>;
    storageFee?: StorageFee;
    legalFee?: LegalFee;
    events: JsonEvent[];
    error: () => ExtrinsicError | null;
}

export function toString(extrinsic: JsonExtrinsic, error: ExtrinsicError | null): string {
    return `extrinsic ${ methodToString(extrinsic.call) } ${ errorToString(error) }`
}

export function toStringWithoutError(extrinsic: JsonExtrinsic): string {
    return `extrinsic ${ methodToString(extrinsic.call) }`
}

export interface JsonEvent {
    section: string;
    method: string;
    data: any[];
}

function methodToString(call: TypesJsonCall): string {
    return `method [${call.section}.${call.method}]`
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

export function extractUuid(argKey: string, args: TypesJsonObject): string {
    return UUID.fromDecimalStringOrThrow(Adapters.asBigInt(args[argKey]).toString()).toString();
}

export function findEventData(extrinsic: JsonExtrinsic, method: { pallet: string, method: string }): any[] | undefined {
    const event = extrinsic.events
        .find(event => {
            return event.section === method.pallet && event.method === method.method;

        });
    if (event === undefined) {
        return undefined;
    } else {
        return event.data;
    }
}

