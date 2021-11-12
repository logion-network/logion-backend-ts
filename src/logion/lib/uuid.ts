import BN from 'bn.js';

export function decimalToUuid(decimal: string): string {
    let hex = new BN(decimal, 10).toString(16);
    if(hex.length < 32) {
        hex = hex.padStart(32, "0");
    } else if(hex.length > 32) {
        throw new Error("Invalid decimal representation of a UUID");
    }
    return hex.substring(0, 8)
        + "-" + hex.substring(8, 12)
        + "-" + hex.substring(12, 16)
        + "-" + hex.substring(16, 20)
        + "-" + hex.substring(20, 32);
}
