import { sha256 } from '../../../../src/logion/lib/crypto/hashing';

describe('HashingTest', () => {

    it("hashes single string", () => {
        sha256HashTest("iNQmb9TmM40TuEX88olXnSCciXgjuSF9o+Fhk28DFYk=", ["abcd"]);
    });

    it("hashes single float", () => {
        sha256HashTest("d6wxm/4ZeeLXmdnmmH5l/rVPYVEcA1UuuumQgmwghZA=", [1.2]);
    });

    it("hashes single int", () => {
        sha256HashTest("s6jg4fmrG/46NvIx9nb3i7MKUZ0rIebFMMDu6Ou0pdA=", [456]);
    });

    it("hashes mixed attributes", () => {
        sha256HashTest("L1IAt8dg2CXiUjCoVZ3wf4uIJWocNgsmhmswXmH0oAU=", ["ABC", 123, true]);
    });
});

function sha256HashTest(expectedHash: string, attributes: any[]) {
    const hash = sha256(attributes);
    expect(hash).toBe(expectedHash);
}
