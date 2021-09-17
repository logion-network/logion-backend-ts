import { It, Mock } from 'moq.ts';
import { BOB } from '../../../src/logion/model/addresses.model';
import { SignatureService } from '../../../src/logion/services/signature.service';
import { SubkeyService, VerifyParams } from '../../../src/logion/services/subkey.service';

describe('SignatureService', () => {

    it('verifies with valid input', async () => testVerify({
        expectedResult: true,
        expectedMessage: "SdPF9uK+K2RNcs0m0OYPXTTNUhJ06/+v8CcZrv9f8jo=",
        attributes: ["abcd"],
    }));

    it('rejects with invalid input', async () => testVerify({
        expectedResult: false,
        expectedMessage: "",
        attributes: ["abcd"],
    }));

    it('verifies with no attributes', async () => testVerify({
        expectedResult: true,
        expectedMessage: "CjwOkiDFvZWqt+uZYPktkdggygroB60g0mVn7QxyZm8=",
        attributes: [],
    }));

    it('rejects with no message nor attributes', async () => testVerify({
        expectedResult: false,
        expectedMessage: "",
        attributes: [],
    }));

    it('verifies with mixed attributes', async () => testVerify({
        expectedResult: true,
        expectedMessage: MIXED_ATTRIBUTES_MESSAGE,
        attributes: ["abc", 123, true],
    }));

    it('verifies with mixed attributes and full nesting', async () => testVerify({
        expectedResult: true,
        expectedMessage: MIXED_ATTRIBUTES_MESSAGE,
        attributes: [["abc", 123, true]],
    }));

    it('verifies with mixed attributes and partial nesting 1', async () => testVerify({
        expectedResult: true,
        expectedMessage: MIXED_ATTRIBUTES_MESSAGE,
        attributes: [["abc", 123], true],
    }));

    it('verifies with mixed attributes and partial nesting 2', async () => testVerify({
        expectedResult: true,
        expectedMessage: MIXED_ATTRIBUTES_MESSAGE,
        attributes: ["abc", [123, true]],
    }));
});

const MIXED_ATTRIBUTES_MESSAGE = "FtvKwzH/OdYXynVMDeOh6WD77O5gYD8LtDzs5qqDf2U=";

async function testVerify(params: {
    expectedResult: boolean;
    expectedMessage: string;
    attributes: any[];
}) {
    const subkeyService = new Mock<SubkeyService>();
    const signature = "signature";
    const expectedMessage = `<Bytes>${params.expectedMessage}</Bytes>`;
    subkeyService.setup(instance => instance.verify(It.Is<VerifyParams>(params =>
        params.signature === signature
        && params.address === BOB
        && params.message === expectedMessage
    ))).returns(Promise.resolve(true));
    const service = new SignatureService(subkeyService.object());

    const result = await service.verify({
        signature,
        address: BOB,
        operation: "operation",
        resource: "resource",
        timestamp: "2021-05-10T00:00",
        attributes: params.attributes
    })

    expect(result || false).toBe(params.expectedResult);
}
