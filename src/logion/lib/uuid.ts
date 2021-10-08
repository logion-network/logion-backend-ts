import BN from 'bn.js';

export function decimalToUuid(decimal: string): string {
    const hex = new BN(decimal, 10).toString(16);
    return hex.substring(0, 8)
        + "-" + hex.substring(8, 12)
        + "-" + hex.substring(12, 16)
        + "-" + hex.substring(16, 20)
        + "-" + hex.substring(20, 32);
}
