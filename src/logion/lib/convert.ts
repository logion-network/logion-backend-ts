export function toBigInt(value: string | undefined | null, defaultValue?: bigint): bigint | undefined {
    return value !== undefined && value !== null ? BigInt(value) : defaultValue;
}
