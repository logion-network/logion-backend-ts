import { Alchemy, AlchemySettings } from "alchemy-sdk";
import { It, Mock } from "moq.ts";

import { AlchemyFactory, AlchemyService, Network } from "../../../../src/logion/services/ownership/alchemy.service.js";

describe("AlchemyService", () => {

    beforeEach(setupProcessEnv)
    afterEach(tearDownProcessEnv)

    it("returns some owner with expected input", async () => {
        const service = buildAlchemyService();
        const owners = await service.getChecker(expectedNetwork).getOwners(expectedContractAddress, expectedTokenId);
        expect(owners.length).toBe(1);
        expect(owners[0]).toBe(expectedOwners[0]);
    })

    it("returns no owner with unexpected input", async () => {
        const service = buildAlchemyService();
        const owners = await service.getChecker(expectedNetwork).getOwners(anotherContractAddress, expectedTokenId);
        expect(owners.length).toBe(0);
    })
})

function setupProcessEnv() {
    process.env.GOERLI_ALCHEMY_KEY = expectedApiKey;
}

function tearDownProcessEnv() {
    delete process.env.GOERLI_ALCHEMY_KEY;
}

function buildAlchemyService(): AlchemyService {
    const alchemyMock = new Mock<Alchemy>();
    alchemyMock.setup(instance => instance.nft.getOwnersForNft(expectedContractAddress, expectedTokenId)).returnsAsync({ owners: expectedOwners });
    alchemyMock.setup(instance => instance.nft.getOwnersForNft(anotherContractAddress, expectedTokenId)).returnsAsync({ owners: [] });

    const factoryMock = new Mock<AlchemyFactory>();
    factoryMock.setup(instance => instance.buildAlchemy(It.Is<AlchemySettings>(settings =>
        settings.apiKey === expectedApiKey && settings.network === expectedNetwork
    ))).returns(alchemyMock.object());
    return new AlchemyService(factoryMock.object());
}

const expectedNetwork = Network.ETH_GOERLI;
const expectedApiKey = "dMRDl5c9KAkuURTKjYgVN5DN06IBRfZG";
const expectedContractAddress = "0x765df6da33c1ec1f83be42db171d7ee334a46df5";
const expectedTokenId = "4391";
const expectedOwners = [ "0xa6db31d1aee06a3ad7e4e56de3775e80d2f5ea84" ];
const anotherContractAddress = "0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85";
