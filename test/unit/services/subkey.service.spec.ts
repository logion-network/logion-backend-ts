import { SubkeyService } from '../../../src/logion/services/subkey.service';

describe('SubkeyService', () => {

    const subkey = new SubkeyService();

    it('verifies with valid input', async () => {
        const result = await subkey.verify({
            address: THE_ADDRESS,
            message: THE_MESSAGE,
            signature: THE_SIGNATURE
        });
        expect(result).toBe(true);
    });

    it('fails with invalid input', async () => {
        const result = await subkey.verify({
            address: THE_ADDRESS,
            message: ANOTHER_MESSAGE,
            signature: THE_SIGNATURE
        });
        expect(result).toBe(false);
    });

    it('verifies with hex prefixed signature', async () => {
        const result = await subkey.verify({
            address: THE_ADDRESS,
            message: THE_MESSAGE,
            signature: HEX_PREFIXED_SIGNATURE
        });
        expect(result).toBe(true);
    });
});

const THE_ADDRESS = "5Gv8YYFu8H1btvmrJy9FjjAWfb99wrhV3uhPFoNEr918utyR";

const THE_MESSAGE = "test message\n";

const THE_SIGNATURE = "22f91b41ba12f8663ddce26bfc90dbfe6a51683fd3782ad679ab2a5fdbe7d44c2a119f22c74eea22555e5483eb7f42b828f189a38379d59c3b607d2461f0858e";

const ANOTHER_MESSAGE = "another message\n";

const HEX_PREFIXED_SIGNATURE = "0x22f91b41ba12f8663ddce26bfc90dbfe6a51683fd3782ad679ab2a5fdbe7d44c2a119f22c74eea22555e5483eb7f42b828f189a38379d59c3b607d2461f0858e";
