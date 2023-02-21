import { ItemToken } from "@logion/node-api";
import { Mock } from "moq.ts";

import { AlchemyService, Network } from "../../../src/logion/services/alchemy.service.js";
import { OwnershipCheckService } from "../../../src/logion/services/ownershipcheck.service.js";
import { SingularService } from "../../../src/logion/services/singular.service.js";

describe("OwnershipCheckService", () => {
    it("detects ethereum_erc721 ownership", () => testDetectsOwnership(ethereumErc721Item, owner, Network.ETH_MAINNET));
    it("detects no ethereum_erc721 ownership", () => testDetectsNoOwnership(ethereumErc721Item, Network.ETH_MAINNET));
    it("detects ethereum_erc1155 ownership", () => testDetectsOwnership(ethereumErc1155Item, owner, Network.ETH_MAINNET));
    it("detects no ethereum_erc1155 ownership", () => testDetectsNoOwnership(ethereumErc1155Item, Network.ETH_MAINNET));

    it("detects goerli_erc721 ownership", () => testDetectsOwnership(goerliErc721Item, owner, Network.ETH_GOERLI));
    it("detects no goerli_erc721 ownership", () => testDetectsNoOwnership(goerliErc721Item, Network.ETH_GOERLI));
    it("detects goerli_erc1155 ownership", () => testDetectsOwnership(goerliErc1155Item, owner, Network.ETH_GOERLI));
    it("detects no goerli_erc1155 ownership", () => testDetectsNoOwnership(goerliErc1155Item, Network.ETH_GOERLI));

    it("detects owner ownership", () => testDetectsOwnership(ownerItem, owner));
    it("detects no owner ownership", () => testDetectsNoOwnership(ownerItem));

    it("detects singular_kusama ownership", () => testDetectsOwnership(singularKusamaItem, polkadotOwner));
    it("detects no singular_kusama ownership", () => testDetectsNoOwnership(singularKusamaItem));
});

async function testDetectsOwnership(token: ItemToken, owner: string, network?: Network) {
    const alchemyService = mockAlchemyService(network);
    const singularService = mockSingularService();
    const ownershipCheckService = new OwnershipCheckService(alchemyService, singularService);
    const result = await ownershipCheckService.isOwner(owner, token);
    expect(result).toBe(true);
}

function mockAlchemyService(network?: Network): AlchemyService {
    const service = new Mock<AlchemyService>();
    service.setup(instance => instance.getOwners).returns((_network: Network, _contractHash: string, _tokenId: string) => {
        if(network === _network && contractHash === _contractHash && tokenId === _tokenId) {
            return Promise.resolve([ owner ]);
        } else {
            return Promise.resolve([]);
        }
    });
    return service.object();
}

function mockSingularService(): SingularService {
    const service = new Mock<SingularService>();
    service.setup(instance => instance.getOwners).returns((_tokenId: string) => {
        if(singularTokenId === _tokenId) {
            return Promise.resolve([ polkadotOwner ]);
        } else {
            return Promise.resolve([]);
        }
    });
    return service.object();
}

const owner = "0xa6db31d1aee06a3ad7e4e56de3775e80d2f5ea84";

const contractHash = "0x765df6da33c1ec1f83be42db171d7ee334a46df5";

const tokenId = "4391";

const polkadotOwner = "GUo1ZJ9bBCmCt8GZMHRqys1ZdUBCpJKi7CgjH1RkRgVeJNF";

const singularTokenId = "15057162-acba02847598b67746-DSTEST1-LUXEMBOURG_HOUSE-00000001";

async function testDetectsNoOwnership(token: ItemToken, network?: Network) {
    const alchemyService = mockAlchemyService(network);
    const singularService = mockSingularService();
    const ownershipCheckService = new OwnershipCheckService(alchemyService, singularService);
    const result = await ownershipCheckService.isOwner(anotherOwner, token);
    expect(result).toBe(false);
}

const anotherOwner = "0xfbb0e166c6bd0dd29859a5191196a8b3fec48e1c";

const ethereumErc721Item: ItemToken = {
    type: "ethereum_erc721",
    id: `{"contract":"${contractHash}","id":"${tokenId}"}`
};

const ethereumErc1155Item: ItemToken = {
    type: "ethereum_erc1155",
    id: `{"contract":"${contractHash}","id":"${tokenId}"}`
};

const goerliErc721Item: ItemToken = {
    type: "goerli_erc721",
    id: `{"contract":"${contractHash}","id":"${tokenId}"}`
};

const goerliErc1155Item: ItemToken = {
    type: "goerli_erc1155",
    id: `{"contract":"${contractHash}","id":"${tokenId}"}`
};

const ownerItem: ItemToken = {
    type: "owner",
    id: `${owner}`
};

const singularKusamaItem: ItemToken = {
    type: "singular_kusama",
    id: `${singularTokenId}`
};
