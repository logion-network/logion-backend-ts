import { ApiPromise } from "@polkadot/api";
import type { Registry } from '@polkadot/types/types';
import type { ContractExecResultResult } from '@polkadot/types/interfaces';
import type { ContractExecResultOk } from '@polkadot/types/interfaces/contracts';
import { encodeAddress } from '@polkadot/util-crypto';
import { It, Mock } from "moq.ts";

import { AstarNetwork, AstarService, AstarTokenId } from "../../../../src/logion/services/ownership/astar.service.js";
import PSP34 from "../../../../src/logion/services/ownership//psp34.js";
import { ContractPromise } from "@polkadot/api-contract";
import { ContractCallOutcome } from "@polkadot/api-contract/types.js";
import { ContractQuery } from "@polkadot/api-contract/base/types.js";

describe("AstarService", () => {

    beforeAll(setupProcessEnv)
    afterAll(tearDownProcessEnv)

    it("returns owner with expected input from Astar", () => testWithEndpoint("astar", astarEndpoint));
    it("returns owner with expected input from Shiden", () => testWithEndpoint("shiden", shidenEndpoint));
    it("returns owner with expected input from Shibuya", () => testWithEndpoint("shibuya", shibuyaEndpoint));
});

function setupProcessEnv() {
    process.env.ASTAR_ENDPOINT = astarEndpoint;
    process.env.SHIDEN_ENDPOINT = shidenEndpoint;
    process.env.SHIBUYA_ENDPOINT = shibuyaEndpoint;
}

function tearDownProcessEnv() {
    delete process.env.ASTAR_ENDPOINT;
    delete process.env.SHIDEN_ENDPOINT;
    delete process.env.SHIBUYA_ENDPOINT;
}

async function testWithEndpoint(network: AstarNetwork, endpoint: string) {
    const service = buildAstar(endpoint, expectedContractAddress);
    const client = await service.getClient(network, "psp34", expectedContractAddress);
    const owner = await client.getOwnerOf(expectedTokenId);
    expect(owner).toBe(expectedOwnerSubstrate);
}

function buildAstar(expectedEndpoint: string, expectedContractId: string): AstarService {
    const registryMock = new Mock<Registry>();
    registryMock.setup(instance => instance.createType).returns(() => ({} as any));

    const apiMock = new Mock<ApiPromise>();
    apiMock.setup(instance => instance.registry).returns(registryMock.object());
    apiMock.setup(instance => instance.consts.system.blockWeights.maxBlock).returns({} as any);

    const resultOkMock = new Mock<ContractExecResultOk>();
    resultOkMock.setup(instance => instance.flags.isRevert).returns(false);
    resultOkMock.setup(instance => instance.data).returns({} as any);

    const resultMock = new Mock<ContractExecResultResult>();
    resultMock.setup(instance => instance.isOk).returns(true);
    resultMock.setup(instance => instance.asOk).returns(resultOkMock.object());

    const outcomeMock = new Mock<ContractCallOutcome>();
    outcomeMock.setup(instance => instance.result).returns(resultMock.object());

    const messageMock = new Mock<ContractQuery<"promise">>();
    messageMock.setup(instance => instance("", It.IsAny(), expectedTokenId)).returns(Promise.resolve(Promise.resolve(outcomeMock.object())));

    const contractMock = new Mock<ContractPromise>();
    contractMock.setup(instance => instance.query).returns({
        [ "psp34::ownerOf" ]: messageMock.object(),
    });
    contractMock.setup(instance => instance.abi.messages).returns(PSP34.spec.messages as any);
    contractMock.setup(instance => instance.abi.registry.createTypeUnsafe).returns(() => ({
        isOk: true,
        asOk: {
            toString: () => expectedOwnerAstar,
        }
    }) as any);

    const apiFactory = (endpoint: string, abi: any, contractId: string) => {
        if(endpoint === expectedEndpoint && contractId === expectedContractId && abi.spec.messages[0].label === "PSP34::owner_of") {
            return Promise.resolve({
                api: apiMock.object(),
                contract: contractMock.object(),
            });
        } else {
            throw new Error();
        }
    };
    return new AstarService(apiFactory);
}

const astarEndpoint = "wss://rpc.astar.network"
const shidenEndpoint = "wss://rpc.shiden.astar.network"
const shibuyaEndpoint = "wss://rpc.shibuya.astar.network"

const expectedContractAddress = "XyNVZ92vFrYf4rCj8EoAXMRWRG7okRy7gxhn167HaYQZqTc";
const expectedTokenId: AstarTokenId = { U32: 1 };
const expectedOwnerAstar = "ajYMsCKsEAhEvHpeA4XqsfiA9v1CdzZPrCfS6pEfeGHW9j8";
const expectedOwnerSubstrate = encodeAddress(expectedOwnerAstar, 42);
