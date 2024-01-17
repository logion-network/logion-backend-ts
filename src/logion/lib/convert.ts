import { Lgnt } from "@logion/node-api";

export function toBigInt(value: string | undefined | null, defaultValue?: bigint): bigint | undefined {
    return value !== undefined && value !== null ? BigInt(value) : defaultValue;
}

export function toLgnt(value: string | undefined | null): Lgnt | undefined {
    const canonical = toBigInt(value);
    return canonical ? Lgnt.fromCanonical(canonical) : undefined;
}
