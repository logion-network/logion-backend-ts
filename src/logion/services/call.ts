import { CallBase, AnyTuple, AnyJson } from '@polkadot/types/types';
import { FunctionMetadataLatest } from "@polkadot/types/interfaces";
import { UUID } from "@logion/node-api";
import { JsonExtrinsic } from "./types/responses/Extrinsic";

export interface JsonCall {
    [key: string]: AnyJson;
    method: string;
    section: string;
    args: JsonArgs;
}

export interface JsonArgs {
    [key: string]: AnyJson;
}

export function toJsonCall(genericCall: CallBase<AnyTuple, FunctionMetadataLatest>): JsonCall {
    const args: {[index: string]: AnyJson} = {};

    for (let i = 0; i < genericCall.args.length; ++i) {
        const arg = genericCall.args[i];
        const meta = genericCall.meta.fields[i];
        args[meta.name.unwrap().toString()] = arg.toHuman(true);
    }

    return {
        section: genericCall.section,
        method: genericCall.method,
        args,
    };
}

export function isJsonObject(anyJson: AnyJson): anyJson is { [index: string]: AnyJson } {
    return typeof anyJson === "object";
}

export function asJsonObject(anyJson: AnyJson): { [index: string]: AnyJson } {
    if(isJsonObject(anyJson)) {
        return anyJson;
    } else {
        throw new Error("Not an object");
    }
}

export function isString(anyJson: AnyJson): anyJson is string {
    return typeof anyJson === "string";
}

export function asString(anyJson: AnyJson): string {
    if(isString(anyJson)) {
        return anyJson;
    } else {
        throw new Error("Not a string");
    }
}

export function isArray(anyJson: AnyJson): anyJson is AnyJson[] {
    return anyJson instanceof Array;
}

export function asArray(anyJson: AnyJson): AnyJson[] {
    if(isArray(anyJson)) {
        return anyJson;
    } else {
        throw new Error("Not an array");
    }
}

export function isHexString(anyJson: AnyJson): anyJson is string {
    return typeof anyJson === "string" && anyJson.startsWith("0x");
}

export function asHexString(anyJson: AnyJson): string {
    if(isHexString(anyJson)) {
        return anyJson;
    } else {
        throw new Error("Not a string");
    }
}

export function isNumberString(anyJson: AnyJson): anyJson is string {
    return typeof anyJson === "string";
}

export function asBigInt(anyJson: AnyJson): bigint {
    if(isString(anyJson)) {
        return BigInt(anyJson.replaceAll(",", ""));
    } else {
        throw new Error("Not a string");
    }
}

export function isJsonCall(anyJson: AnyJson): anyJson is JsonCall {
    return isJsonObject(anyJson)
        && "section" in anyJson && isString(anyJson.section)
        && "method" in anyJson && isString(anyJson.method)
        && "args" in anyJson && isJsonObject(anyJson.args);
}

export function asJsonCall(anyJson: AnyJson): JsonCall {
    if(isJsonCall(anyJson)) {
        return anyJson;
    } else {
        throw new Error("Not a JsonCall");
    }
}

export function extractLocId(locIdKey: string, args: JsonArgs): string {
    return UUID.fromDecimalStringOrThrow(asBigInt(args[locIdKey]).toString()).toString();
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

