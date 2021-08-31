import { GenericCall, Struct } from '@polkadot/types';
import { Codec, Registry } from '@polkadot/types/types';

export interface JsonCall {
    [key: string]: unknown;
    method: JsonMethod;
    callIndex?: Uint8Array | string;
    args: JsonArgs;
}

export interface JsonMethod {
    pallet: string;
    method: string;
}

export interface JsonArgs {
    [key: string]: any;
}

export function isJsonMethod(thing: unknown): thing is JsonMethod {
    return (
        typeof (thing as JsonMethod).pallet === 'string' &&
        typeof (thing as JsonMethod).method === 'string'
    );
}

export function toJsonCall(
    genericCall: GenericCall,
    registry: Registry
): JsonCall {
    const newArgs: {[index: string]:any} = {};
    const callArgs = genericCall.get('args') as Struct;
    if (callArgs && callArgs.defKeys) {
        for (const paramName of callArgs.defKeys) {
            const argument = callArgs.get(paramName);

            if (Array.isArray(argument)) {
                newArgs[paramName] = toJsonCallArray(argument, registry);
            } else if (argument instanceof GenericCall) {
                newArgs[paramName] = toJsonCall(argument, registry);
            } else if (paramName === 'call' && argument?.toRawType() === 'Bytes') {
                try {
                    const call = registry.createType('Call', argument.toHex());
                    newArgs[paramName] = toJsonCall(call, registry);
                } catch {
                    newArgs[paramName] = argument;
                }
            } else {
                newArgs[paramName] = argument;
            }
        }
    }

    return {
        method: {
            pallet: genericCall.section,
            method: genericCall.method,
        },
        args: newArgs,
    };
}

export function toJsonCallArray(
    argsArray: Codec[],
    registry: Registry
): (Codec | JsonCall)[] {
    return argsArray.map((argument) => {
        if (argument instanceof GenericCall) {
            return toJsonCall(argument, registry);
        } else {
            return argument;
        }
    });
}
