import { sha256, sha256File, HashTransformer, sha256String } from '../../../../src/logion/lib/crypto/hashing.js';

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

    it("hashes text file", async () => {
        const hash = await sha256File("test/unit/lib/crypto/file.txt");
        expect(hash).toBe("0x0ba904eae8773b70c75333db4de2f3ac45a8ad4ddba1b242f0b3cfc199391dd8");
    });

    it("hashes binary file", async () => {
        const hash = await sha256File("test/unit/lib/crypto/assets.png");
        expect(hash).toBe("0x68a87ced4573656b101940c90ac3bdc24b651f688c06e71c70d37f43dfc5058c");
    });

    it("convert from/to Buffer", () => {
        const transformer = HashTransformer.instance;
        const hash = sha256String("abc123");
        const buffer = transformer.to(hash);
        expect(buffer.length).toEqual(32);
        expect(transformer.from(buffer)).toEqual(hash);
    });
});

function sha256HashTest(expectedHash: string, attributes: any[]) {
    const hash = sha256(attributes);
    expect(hash).toBe(expectedHash);
}
