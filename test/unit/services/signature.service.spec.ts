import { It, Mock } from 'moq.ts';
import { BOB } from '../../helpers/addresses';
import { SignatureService, VerifyFunction, VerifyFunctionParams } from '../../../src/logion/services/signature.service';

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
    const verifier = new Mock<VerifyFunction>();
    const signature = "signature";
    const expectedMessage = `<Bytes>${ params.expectedMessage }</Bytes>`;
    verifier.setup(instance => instance(It.Is<VerifyFunctionParams>(params =>
            params.signature === signature
            && params.address === BOB
            && params.message === expectedMessage
        )
    )).returns(Promise.resolve(true));
    const service = SignatureService.of(verifier.object());

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
