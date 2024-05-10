import { Mock } from "moq.ts";

import { AlchemyChecker, AlchemyService, Network } from "../../../src/logion/services/ownership/alchemy.service.js";
import { OwnershipCheckService } from "../../../src/logion/services/ownershipcheck.service.js";
import { SingularService } from "../../../src/logion/services/ownership/singular.service.js";
import { MultiversxService, MultiversxTokenType, MultiversxChecker } from "../../../src/logion/services/ownership/multiversx.service.js";
import { CollectionItemTokenDescription } from "src/logion/model/collection.model.js";
import { AstarClient, AstarNetwork, AstarService, AstarTokenId, AstarTokenType } from "src/logion/services/ownership/astar.service.js";
import { ValidAccountId } from "@logion/node-api";

describe("OwnershipCheckService", () => {
    it("detects ethereum_erc721 ownership", () => testDetectsOwnership(ethereumErc721Item, owner, { network: Network.ETH_MAINNET }));
    it("detects no ethereum_erc721 ownership", () => testDetectsNoOwnership(ethereumErc721Item, { network: Network.ETH_MAINNET }));
    it("detects ethereum_erc1155 ownership", () => testDetectsOwnership(ethereumErc1155Item, owner, { network: Network.ETH_MAINNET }));
    it("detects no ethereum_erc1155 ownership", () => testDetectsNoOwnership(ethereumErc1155Item, { network: Network.ETH_MAINNET }));
    it("detects ethereum_erc20 ownership", () => testDetectsOwnership(ethereumErc20, owner, { network: Network.ETH_MAINNET }));
    it("detects no ethereum_erc20 ownership", () => testDetectsNoOwnership(ethereumErc20, { network: Network.ETH_MAINNET }));

    it("detects goerli_erc721 ownership", () => testDetectsOwnership(goerliErc721Item, owner, { network: Network.ETH_SEPOLIA }));
    it("detects no goerli_erc721 ownership", () => testDetectsNoOwnership(goerliErc721Item, { network: Network.ETH_SEPOLIA }));
    it("detects goerli_erc1155 ownership", () => testDetectsOwnership(goerliErc1155Item, owner, { network: Network.ETH_SEPOLIA }));
    it("detects no goerli_erc1155 ownership", () => testDetectsNoOwnership(goerliErc1155Item, { network: Network.ETH_SEPOLIA }));
    it("detects goerli_erc20 ownership", () => testDetectsOwnership(goerliErc20, owner, { network: Network.ETH_SEPOLIA }));
    it("detects no goerli_erc20 ownership", () => testDetectsNoOwnership(goerliErc20, { network: Network.ETH_SEPOLIA }));

    it("detects polygon_erc721 ownership", () => testDetectsOwnership(polygonErc721Item, owner, { network: Network.MATIC_MAINNET }));
    it("detects no polygon_erc721 ownership", () => testDetectsNoOwnership(polygonErc721Item, { network: Network.MATIC_MAINNET }));
    it("detects polygon_erc1155 ownership", () => testDetectsOwnership(polygonErc1155Item, owner, { network: Network.MATIC_MAINNET }));
    it("detects no polygon_erc1155 ownership", () => testDetectsNoOwnership(polygonErc1155Item, { network: Network.MATIC_MAINNET }));
    it("detects polygon_erc20 ownership", () => testDetectsOwnership(polygonErc20, owner, { network: Network.MATIC_MAINNET }));
    it("detects no polygon_erc20 ownership", () => testDetectsNoOwnership(polygonErc20, { network: Network.MATIC_MAINNET }));

    it("detects polygon_mumbai_erc721 ownership", () => testDetectsOwnership(mumbaiErc721Item, owner, { network: Network.MATIC_AMOY }));
    it("detects no polygon_mumbai_erc721 ownership", () => testDetectsNoOwnership(mumbaiErc721Item, { network: Network.MATIC_AMOY }));
    it("detects polygon_mumbai_erc1155 ownership", () => testDetectsOwnership(mumbaiErc1155Item, owner, { network: Network.MATIC_AMOY }));
    it("detects no polygon_mumbai_erc1155 ownership", () => testDetectsNoOwnership(mumbaiErc1155Item, { network: Network.MATIC_AMOY }));
    it("detects polygon_mumbai_erc20 ownership", () => testDetectsOwnership(mumbaiErc20, owner, { network: Network.MATIC_AMOY }));
    it("detects no polygon_mumbai_erc20 ownership", () => testDetectsNoOwnership(mumbaiErc20, { network: Network.MATIC_AMOY }));

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

    it("detects astar ownership", () => testDetectsOwnership(astar, astarOwner, { astarNetwork: "astar", ...astarTestConfig }));
    it("detects no astar ownership", () => testDetectsNoOwnership(astar, { astarNetwork: "astar", ...astarTestConfig }));
    it("detects shiden ownership", () => testDetectsOwnership(shiden, astarOwner, { astarNetwork: "shiden", ...astarTestConfig }));
    it("detects no shiden ownership", () => testDetectsNoOwnership(shiden, { astarNetwork: "shiden", ...astarTestConfig }));
    it("detects shibuya ownership", () => testDetectsOwnership(shibuya, astarOwner, { astarNetwork: "shibuya", ...astarTestConfig }));
    it("detects no shibuya ownership", () => testDetectsNoOwnership(shibuya, { astarNetwork: "shibuya", ...astarTestConfig }));
});

type TestConfig = {
    network?: Network;
    tokenType?: MultiversxTokenType;
    astarNetwork?: AstarNetwork;
    astarTokenType?: AstarTokenType;
    astarContractId?: string;
};

async function testDetectsOwnership(token: CollectionItemTokenDescription, owner: ValidAccountId, config?: TestConfig) {
    const alchemyService = mockAlchemyService(config?.network);
    const singularService = mockSingularService();
    const multiversxService = mockMultiversxService(config?.tokenType);
    const astarService = mockAstarService(config?.astarNetwork, config?.astarTokenType, config?.astarContractId);
    const ownershipCheckService = new OwnershipCheckService(alchemyService, singularService, multiversxService, astarService);
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
    checker.setup(instance => instance.getBalances).returns((account: ValidAccountId, _contractHash: string) => {
        if(contractHash === _contractHash && account.equals(owner)) {
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
    checker.setup(instance => instance.isOwnerOf).returns((account: ValidAccountId, tokenId: string) => account.equals(multiversxOwner) && tokenId === multiversxTokenId ? Promise.resolve(true) : Promise.resolve(false));
    const service = new Mock<MultiversxService>();
    service.setup(instance => instance.getChecker).returns((tokenType: MultiversxTokenType) => tokenType === type ? checker.object() : undefined)
    return service.object();
}

function mockAstarService(expectedNetwork: AstarNetwork | undefined, expectedTokenType: AstarTokenType | undefined, expectedContractId: string | undefined): AstarService {
    const client = new Mock<AstarClient>();
    client.setup(instance => instance.getOwnerOf).returns((tokenId: AstarTokenId) => tokenId.U32 === astarTokenId.U32 ? Promise.resolve(astarOwner) : Promise.resolve(undefined));
    client.setup(instance => instance.disconnect()).returns(Promise.resolve());
    const service = new Mock<AstarService>();
    service.setup(instance => instance.getClient).returns((network: AstarNetwork, tokenType: AstarTokenType, contractId: string) => {
        if(tokenType === expectedTokenType && network === expectedNetwork && contractId === expectedContractId) {
            return Promise.resolve(client.object());
        } else {
            throw new Error();
        }
    });
    return service.object();
}

const owner = ValidAccountId.ethereum("0xa6db31d1aee06a3ad7e4e56de3775e80d2f5ea84");

const contractHash = "0x765df6da33c1ec1f83be42db171d7ee334a46df5";

const tokenId = "4391";

const polkadotOwner = ValidAccountId.polkadot("GUo1ZJ9bBCmCt8GZMHRqys1ZdUBCpJKi7CgjH1RkRgVeJNF");

const singularTokenId = "15057162-acba02847598b67746-DSTEST1-LUXEMBOURG_HOUSE-00000001";

const multiversxTokenId = "LRCOLL001-e42371-01";

const multiversxOwner = ValidAccountId.bech32("erd1urwqlj8rp3xlpqvu7stcsjsxyhs3skgy0exvly3hr7g92yjeey3sqpvkyx");

const astarTokenId = { U32: 42 };

const astarOwner = ValidAccountId.polkadot("ajYMsCKsEAhEvHpeA4XqsfiA9v1CdzZPrCfS6pEfeGHW9j8");

const astarContractId = "XyNVZ92vFrYf4rCj8EoAXMRWRG7okRy7gxhn167HaYQZqTc";

const astarTestConfig = { astarTokenType: "psp34" as AstarTokenType, astarContractId };

async function testDetectsNoOwnership(token: CollectionItemTokenDescription, config?: TestConfig) {
    const alchemyService = mockAlchemyService(config?.network);
    const singularService = mockSingularService();
    const multiversxService = mockMultiversxService(config?.tokenType);
    const astarService = mockAstarService(config?.astarNetwork, config?.astarTokenType, config?.astarContractId);
    const ownershipCheckService = new OwnershipCheckService(alchemyService, singularService, multiversxService, astarService);
    const result = await ownershipCheckService.isOwner(anotherOwner, token);
    expect(result).toBe(false);
}

const anotherOwner = ValidAccountId.ethereum("0xfbb0e166c6bd0dd29859a5191196a8b3fec48e1c");

const ethereumErc721Item: CollectionItemTokenDescription = {
    type: "ethereum_erc721",
    id: `{"contract":"${contractHash}","id":"${tokenId}"}`
};

const ethereumErc1155Item: CollectionItemTokenDescription = {
    type: "ethereum_erc1155",
    id: `{"contract":"${contractHash}","id":"${tokenId}"}`
};

const goerliErc721Item: CollectionItemTokenDescription = {
    type: "goerli_erc721",
    id: `{"contract":"${contractHash}","id":"${tokenId}"}`
};

const goerliErc1155Item: CollectionItemTokenDescription = {
    type: "goerli_erc1155",
    id: `{"contract":"${contractHash}","id":"${tokenId}"}`
};

const ownerItem: CollectionItemTokenDescription = {
    type: "owner",
    id: `${owner.address}`
};

const singularKusamaItem: CollectionItemTokenDescription = {
    type: "singular_kusama",
    id: `${singularTokenId}`
};

const ethereumErc20: CollectionItemTokenDescription = {
    type: "ethereum_erc20",
    id: `{"contract":"${contractHash}"}`
};

const goerliErc20: CollectionItemTokenDescription = {
    type: "goerli_erc20",
    id: `{"contract":"${contractHash}"}`
};

const multiversxDevnet: CollectionItemTokenDescription = {
    type: "multiversx_devnet_esdt",
    id: `${ multiversxTokenId }`
}

const multiversxTestnet: CollectionItemTokenDescription = {
    type: "multiversx_testnet_esdt",
    id: `${ multiversxTokenId }`
}

const multiversxMainnet: CollectionItemTokenDescription = {
    type: "multiversx_esdt",
    id: `${ multiversxTokenId }`
}

const astar: CollectionItemTokenDescription = {
    type: "astar_psp34",
    id: JSON.stringify({ contract: astarContractId, id: astarTokenId }),
}

const shiden: CollectionItemTokenDescription = {
    type: "astar_shiden_psp34",
    id: JSON.stringify({ contract: astarContractId, id: astarTokenId }),
}

const shibuya: CollectionItemTokenDescription = {
    type: "astar_shibuya_psp34",
    id: JSON.stringify({ contract: astarContractId, id: astarTokenId }),
}

const polygonErc721Item: CollectionItemTokenDescription = {
    type: "polygon_erc721",
    id: `{"contract":"${contractHash}","id":"${tokenId}"}`
};

const polygonErc1155Item: CollectionItemTokenDescription = {
    type: "polygon_erc1155",
    id: `{"contract":"${contractHash}","id":"${tokenId}"}`
};

const mumbaiErc721Item: CollectionItemTokenDescription = {
    type: "polygon_mumbai_erc721",
    id: `{"contract":"${contractHash}","id":"${tokenId}"}`
};

const mumbaiErc1155Item: CollectionItemTokenDescription = {
    type: "polygon_mumbai_erc1155",
    id: `{"contract":"${contractHash}","id":"${tokenId}"}`
};

const polygonErc20: CollectionItemTokenDescription = {
    type: "polygon_erc20",
    id: `{"contract":"${contractHash}"}`
};

const mumbaiErc20: CollectionItemTokenDescription = {
    type: "polygon_mumbai_erc20",
    id: `{"contract":"${contractHash}"}`
};
