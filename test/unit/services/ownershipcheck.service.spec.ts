import { CollectionItem } from "@logion/node-api/dist/Types";
import { It, Mock } from "moq.ts";

import { EtherscanService } from "../../../src/logion/services/Etherscan.service";
import { OwnershipCheckService } from "../../../src/logion/services/ownershipcheck.service";
import { emptyHolderInventory, tokenInventoryWithAnotherHolder, tokenInventoryWithHolder } from "./etherscanscrapper.spec";

const owner = "0xa6db31d1aee06a3ad7e4e56de3775e80d2f5ea84";

const anotherOwner = "0xfbb0e166c6bd0dd29859a5191196a8b3fec48e1c";

const contractHash = "0x765df6da33c1ec1f83be42db171d7ee334a46df5";

const tokenId = "4391";

const ethereumErc721Item: CollectionItem = {
    id: "0xf2ca1bb6c7e907d06dafe4687e579fce76b37e4e93b7605022da52e6ccc26fd2",
    description: "Some artwork",
    files: [{
        name: "image.png",
        contentType: "image/png",
        hash: "0x7d6fd7774f0d87624da6dcf16d0d3d104c3191e771fbe2f39c86aed4b2bf1a0f",
        size: 1234n
    }],
    token: {
        type: "ethereum_erc721",
        id: `{"contract":"${contractHash}","id":"${tokenId}"}`
    },
    restrictedDelivery: true,
    termsAndConditions: [],
};

const ethereumErc1155Item: CollectionItem = {
    id: "0xf2ca1bb6c7e907d06dafe4687e579fce76b37e4e93b7605022da52e6ccc26fd2",
    description: "Some artwork",
    files: [{
        name: "image.png",
        contentType: "image/png",
        hash: "0x7d6fd7774f0d87624da6dcf16d0d3d104c3191e771fbe2f39c86aed4b2bf1a0f",
        size: 1234n
    }],
    token: {
        type: "ethereum_erc1155",
        id: `{"contract":"${contractHash}","id":"${tokenId}"}`
    },
    restrictedDelivery: true,
    termsAndConditions: [],
};

const goerliErc721Item: CollectionItem = {
    id: "0xf2ca1bb6c7e907d06dafe4687e579fce76b37e4e93b7605022da52e6ccc26fd2",
    description: "Some artwork",
    files: [{
        name: "image.png",
        contentType: "image/png",
        hash: "0x7d6fd7774f0d87624da6dcf16d0d3d104c3191e771fbe2f39c86aed4b2bf1a0f",
        size: 1234n
    }],
    token: {
        type: "ethereum_erc721",
        id: `{"contract":"${contractHash}","id":"${tokenId}"}`
    },
    restrictedDelivery: true,
    termsAndConditions: [],
};

const goerliErc1155Item: CollectionItem = {
    id: "0xf2ca1bb6c7e907d06dafe4687e579fce76b37e4e93b7605022da52e6ccc26fd2",
    description: "Some artwork",
    files: [{
        name: "image.png",
        contentType: "image/png",
        hash: "0x7d6fd7774f0d87624da6dcf16d0d3d104c3191e771fbe2f39c86aed4b2bf1a0f",
        size: 1234n
    }],
    token: {
        type: "ethereum_erc1155",
        id: `{"contract":"${contractHash}","id":"${tokenId}"}`
    },
    restrictedDelivery: true,
    termsAndConditions: [],
};

const ownerItem: CollectionItem = {
    id: "0xf2ca1bb6c7e907d06dafe4687e579fce76b37e4e93b7605022da52e6ccc26fd2",
    description: "Some artwork",
    files: [{
        name: "image.png",
        contentType: "image/png",
        hash: "0x7D6fd7774f0d87624da6dCF16d0d3d104c3191e771fbe2f39c86aed4b2bf1a0F",
        size: 1234n
    }],
    token: {
        type: "owner",
        id: `${owner}`
    },
    restrictedDelivery: true,
    termsAndConditions: [],
};

describe("OwnershipCheckService", () => {

    it("detects ethereum_erc721 ownership", async () => {
        await testDetectsOwnership(ethereumErc721Item);
    });

    it("detects no ethereum_erc721 ownership", async () => {
        await testDetectsNoOwnership(ethereumErc721Item);
    });

    it("detects ethereum_erc1155 ownership", async () => {
        await testDetectsOwnership(ethereumErc1155Item);
    });

    it("detects no ethereum_erc1155 ownership", async () => {
        await testDetectsNoOwnership(ethereumErc1155Item);
    });

    it("detects goerli_erc721 ownership", async () => {
        await testDetectsOwnership(goerliErc721Item);
    });

    it("detects no goerli_erc721 ownership", async () => {
        await testDetectsNoOwnership(goerliErc721Item);
    });

    it("detects goerli_erc1155 ownership", async () => {
        await testDetectsOwnership(goerliErc1155Item);
    });

    it("detects no goerli_erc1155 ownership", async () => {
        await testDetectsNoOwnership(goerliErc1155Item);
    });

    it("detects owner ownership", async () => {
        await testDetectsOwnership(ownerItem);
    });

    it("detects no owner ownership", async () => {
        await testDetectsNoOwnership(ownerItem);
    });
});

function mockEtherscanService(): EtherscanService {
    const service = new Mock<EtherscanService>();

    // First page does not contain holder
    service.setup(instance => instance.getTokenHolderInventoryPage(It.Is<{
        contractHash: string,
        tokenId: string,
        page: number,
    }>(param => param.contractHash === contractHash && param.tokenId === tokenId && param.page === 1))).returnsAsync(tokenInventoryWithAnotherHolder);

    // Second page contains expected holder
    service.setup(instance => instance.getTokenHolderInventoryPage(It.Is<{
        contractHash: string,
        tokenId: string,
        page: number,
    }>(param => param.contractHash === contractHash && param.tokenId === tokenId && param.page === 2))).returnsAsync(tokenInventoryWithHolder);

    // Next pages are empty
    service.setup(instance => instance.getTokenHolderInventoryPage(It.Is<{
        contractHash: string,
        tokenId: string,
        page: number,
    }>(param => param.contractHash === contractHash && param.tokenId === tokenId && param.page > 2))).returnsAsync(emptyHolderInventory);

    // Any other page is empty
    service.setup(instance => instance.getTokenHolderInventoryPage(It.Is<{
        contractHash: string,
        tokenId: string,
        page: number,
    }>(param => param.contractHash === contractHash && param.tokenId !== tokenId))).returnsAsync(emptyHolderInventory);

    return service.object();
}

async function testDetectsOwnership(item: CollectionItem) {
    const etherscanService = mockEtherscanService();
    const ownershipCheckService = new OwnershipCheckService(etherscanService);
    const result = await ownershipCheckService.isOwner(owner, item);
    expect(result).toBe(true);
}

async function testDetectsNoOwnership(item: CollectionItem) {
    const etherscanService = mockEtherscanService();
        const ownershipCheckService = new OwnershipCheckService(etherscanService);
        const result = await ownershipCheckService.isOwner(anotherOwner, item);
        expect(result).toBe(false);
}
