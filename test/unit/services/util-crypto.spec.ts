import { signatureVerify } from "@polkadot/util-crypto";
import { waitReady } from '@polkadot/wasm-crypto';

describe('util-crypto', () => {

    beforeEach(async (): Promise<void> => {
        await waitReady();
    });

    it('fails with invalid input', () => {
        const result = signatureVerify(ANOTHER_MESSAGE, HEX_PREFIXED_SIGNATURE, THE_ADDRESS);
        expect(result.isValid).toBe(false);
    });

    it('verifies with hex prefixed signature', () => {
        const result = signatureVerify(THE_MESSAGE, HEX_PREFIXED_SIGNATURE, THE_ADDRESS);
        expect(result.isValid).toBe(true);
    });
});

const THE_ADDRESS = "5Gv8YYFu8H1btvmrJy9FjjAWfb99wrhV3uhPFoNEr918utyR";

const THE_MESSAGE = "test message\n";

const ANOTHER_MESSAGE = "another message\n";

const HEX_PREFIXED_SIGNATURE = "0x22f91b41ba12f8663ddce26bfc90dbfe6a51683fd3782ad679ab2a5fdbe7d44c2a119f22c74eea22555e5483eb7f42b828f189a38379d59c3b607d2461f0858e";
