import { ItemToken, ItemTokenWithoutIssuance } from "@logion/node-api";
import { Mock } from "moq.ts";

import { AlchemyChecker, AlchemyService, Network } from "../../../src/logion/services/alchemy.service.js";
import { OwnershipCheckService } from "../../../src/logion/services/ownershipcheck.service.js";
import { SingularService } from "../../../src/logion/services/singular.service.js";
import { MultiversxService, MultiversxTokenType, MultiversxChecker } from "../../../src/logion/services/multiversx.service.js";

describe("OwnershipCheckService", () => {
    it("detects ethereum_erc721 ownership", () => testDetectsOwnership(ethereumErc721Item, owner, { network: Network.ETH_MAINNET }));
    it("detects no ethereum_erc721 ownership", () => testDetectsNoOwnership(ethereumErc721Item, { network: Network.ETH_MAINNET }));
    it("detects ethereum_erc1155 ownership", () => testDetectsOwnership(ethereumErc1155Item, owner, { network: Network.ETH_MAINNET }));
    it("detects no ethereum_erc1155 ownership", () => testDetectsNoOwnership(ethereumErc1155Item, { network: Network.ETH_MAINNET }));

    it("detects goerli_erc721 ownership", () => testDetectsOwnership(goerliErc721Item, owner, { network: Network.ETH_GOERLI }));
    it("detects no goerli_erc721 ownership", () => testDetectsNoOwnership(goerliErc721Item, { network: Network.ETH_GOERLI }));
    it("detects goerli_erc1155 ownership", () => testDetectsOwnership(goerliErc1155Item, owner, { network: Network.ETH_GOERLI }));
    it("detects no goerli_erc1155 ownership", () => testDetectsNoOwnership(goerliErc1155Item, { network: Network.ETH_GOERLI }));

    it("detects ethereum_erc20 ownership", () => testDetectsOwnership(ethereumErc20, owner, { network: Network.ETH_MAINNET }));
    it("detects no ethereum_erc20 ownership", () => testDetectsNoOwnership(ethereumErc20, { network: Network.ETH_MAINNET }));
    it("detects goerli_erc20 ownership", () => testDetectsOwnership(goerliErc20, owner, { network: Network.ETH_GOERLI }));
    it("detects no goerli_erc20 ownership", () => testDetectsNoOwnership(goerliErc20, { network: Network.ETH_GOERLI }));

    it("detects owner ownership", () => testDetectsOwnership(ownerItem, owner));
    it("detects no owner ownership", () => testDetectsNoOwnership(ownerItem));

    it("detects singular_kusama ownership", () => testDetectsOwnership(singularKusamaItem, polkadotOwner));
    it("detects no singular_kusama ownership", () => testDetectsNoOwnership(singularKusamaItem));

    it("detects multiversx Devnet ownership", () => testDetectsOwnership(multiversxDevnet, multiversxOwner, { tokenType: "multiversx_devnet_esdt" }));
    it("detects no multiversx Devnet ownership", () => testDetectsNoOwnership(multiversxDevnet, { tokenType: "multiversx_devnet_esdt" }));

    it("detects multiversx Testnet ownership", () => testDetectsOwnership(multiversxTestnet, multiversxOwner, { tokenType: "multiversx_testnet_esdt" }));
    it("detects no multiversx Testnet ownership", () => testDetectsNoOwnership(multiversxTestnet, { tokenType: "multiversx_testnet_esdt" }));

    it("detects multiversx Mainnet ownership", () => testDetectsOwnership(multiversxMainnet, multiversxOwner, { tokenType: "multiversx_esdt" }));
    it("detects no multiversx Mainnet ownership", () => testDetectsNoOwnership(multiversxMainnet, { tokenType: "multiversx_esdt" }));
});

type TestConfig = { network?: Network; tokenType?: MultiversxTokenType };

async function testDetectsOwnership(token: ItemTokenWithoutIssuance, owner: string, config?: TestConfig) {
    const alchemyService = mockAlchemyService(config?.network);
    const singularService = mockSingularService();
    const multiversxService = mockMultiversxService(config?.tokenType);
    const ownershipCheckService = new OwnershipCheckService(alchemyService, singularService, multiversxService);
    const result = await ownershipCheckService.isOwner(owner, token);
    expect(result).toBe(true);
}

function mockAlchemyService(network?: Network): AlchemyService {
    const service = new Mock<AlchemyService>();
    const checker = new Mock<AlchemyChecker>();
    checker.setup(instance => instance.getOwners).returns((_contractHash: string, _tokenId: string) => {
        if(contractHash === _contractHash && tokenId === _tokenId) {
            return Promise.resolve([ owner ]);
        } else {
            return Promise.resolve([]);
        }
    });
    checker.setup(instance => instance.getBalances).returns((address: string, _contractHash: string) => {
        if(contractHash === _contractHash && address === owner) {
            return Promise.resolve([{
                contractAddress: _contractHash,
                tokenBalance: "0x01",
                error: null,
            }]);
        } else {
            return Promise.resolve([]);
        }
    });
    if(network) {
        service.setup(instance => instance.getChecker(network)).returns(checker.object());
    }
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

function mockMultiversxService(type: MultiversxTokenType | undefined): MultiversxService {
    const checker = new Mock<MultiversxChecker>();
    checker.setup(instance => instance.isOwnerOf).returns((address: string, tokenId: string) => address === multiversxOwner && tokenId === multiversxTokenId ? Promise.resolve(true) : Promise.resolve(false));
    const service = new Mock<MultiversxService>();
    service.setup(instance => instance.getChecker).returns((tokenType: MultiversxTokenType) => tokenType === type ? checker.object() : undefined)
    return service.object();
}

const owner = "0xa6db31d1aee06a3ad7e4e56de3775e80d2f5ea84";

const contractHash = "0x765df6da33c1ec1f83be42db171d7ee334a46df5";

const tokenId = "4391";

const polkadotOwner = "GUo1ZJ9bBCmCt8GZMHRqys1ZdUBCpJKi7CgjH1RkRgVeJNF";

const singularTokenId = "15057162-acba02847598b67746-DSTEST1-LUXEMBOURG_HOUSE-00000001";

const multiversxTokenId = "LRCOLL001-e42371-01";

const multiversxOwner = "erd1urwqlj8rp3xlpqvu7stcsjsxyhs3skgy0exvly3hr7g92yjeey3sqpvkyx";

async function testDetectsNoOwnership(token: ItemTokenWithoutIssuance, config?: TestConfig) {
    const alchemyService = mockAlchemyService(config?.network);
    const singularService = mockSingularService();
    const multiversxService = mockMultiversxService(config?.tokenType);
    const ownershipCheckService = new OwnershipCheckService(alchemyService, singularService, multiversxService);
    const result = await ownershipCheckService.isOwner(anotherOwner, token);
    expect(result).toBe(false);
}

const anotherOwner = "0xfbb0e166c6bd0dd29859a5191196a8b3fec48e1c";

const ethereumErc721Item: ItemToken = {
    type: "ethereum_erc721",
    id: `{"contract":"${contractHash}","id":"${tokenId}"}`,
    issuance: 1n,
};

const ethereumErc1155Item: ItemToken = {
    type: "ethereum_erc1155",
    id: `{"contract":"${contractHash}","id":"${tokenId}"}`,
    issuance: 1n,
};

const goerliErc721Item: ItemToken = {
    type: "goerli_erc721",
    id: `{"contract":"${contractHash}","id":"${tokenId}"}`,
    issuance: 1n,
};

const goerliErc1155Item: ItemToken = {
    type: "goerli_erc1155",
    id: `{"contract":"${contractHash}","id":"${tokenId}"}`,
    issuance: 1n,
};

const ownerItem: ItemTokenWithoutIssuance = {
    type: "owner",
    id: `${owner}`
};

const singularKusamaItem: ItemToken = {
    type: "singular_kusama",
    id: `${singularTokenId}`,
    issuance: 1n,
};

const ethereumErc20: ItemToken = {
    type: "ethereum_erc20",
    id: `{"contract":"${contractHash}"}`,
    issuance: 100n,
};

const goerliErc20: ItemToken = {
    type: "goerli_erc20",
    id: `{"contract":"${contractHash}"}`,
    issuance: 1n,
};

const multiversxDevnet: ItemTokenWithoutIssuance = {
    type: "multiversx_devnet_esdt",
    id: `${ multiversxTokenId }`
}

const multiversxTestnet: ItemTokenWithoutIssuance = {
    type: "multiversx_testnet_esdt",
    id: `${ multiversxTokenId }`
}

const multiversxMainnet: ItemTokenWithoutIssuance = {
    type: "multiversx_esdt",
    id: `${ multiversxTokenId }`
}
