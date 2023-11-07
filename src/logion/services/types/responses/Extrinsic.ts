import { TypesJsonCall, TypesJsonObject, UUID, Adapters } from "@logion/node-api";

export interface Fee {
    fee: bigint;
    withdrawnFrom: string;
}

export interface LegalFee extends Fee {
    beneficiary?: string;
}

export interface JsonExtrinsic {
    call: TypesJsonCall;
    signer: string | null;
    tip: string | null;
    partialFee: () => Promise<string | undefined>;
    storageFee?: Fee;
    legalFee?: LegalFee;
    certificateFee?: Fee;
    valueFee?: Fee;
    collectionItemFee?: Fee;
    tokensRecordFee?: Fee;
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
    data: any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
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

export function findEventsData(extrinsic: JsonExtrinsic, method: { pallet: string, method: string }) {
    const events = extrinsic.events.filter(event => event.section === method.pallet && event.method === method.method);
    return events.map(event => event.data);
}
