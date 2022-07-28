import { CollectionItem } from "@logion/node-api/dist/Types";
import { It, Mock } from "moq.ts";

import { EtherscanService } from "../../../src/logion/services/Etherscan.service";
import { OwnershipCheckService } from "../../../src/logion/services/ownershipcheck.service";
import { emptyHolderInventory, holderInventoryWithToken } from "./etherscanscrapper.spec";

const owner = "0xa6db31d1aee06a3ad7e4e56de3775e80d2f5ea84";

const anotherOwner = "0xfbb0e166c6bd0dd29859a5191196a8b3fec48e1c";

const contractHash = "0x765df6da33c1ec1f83be42db171d7ee334a46df5";

describe("OwnershipCheckService", () => {

    const item: CollectionItem = {
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
            id: `{"contract":"${contractHash}","id":"4391"}`
        },
        restrictedDelivery: true,
    };

    it("detects ownership", async () => {
        const etherscanService = mockEtherscanService();
        const ownershipCheckService = new OwnershipCheckService(etherscanService);
        const result = await ownershipCheckService.isOwner(owner, item);
        expect(result).toBe(true);
    });

    it("detects no ownership", async () => {
        const etherscanService = mockEtherscanService();
        const ownershipCheckService = new OwnershipCheckService(etherscanService);
        const result = await ownershipCheckService.isOwner(anotherOwner, item);
        expect(result).toBe(false);
    });
});

function mockEtherscanService(): EtherscanService {
    const service = new Mock<EtherscanService>();
    service.setup(instance => instance.getTokenHolderInventoryPage(It.Is<{
        contractHash: string,
        address: string,
        page: number
    }>(param => param.contractHash === contractHash && param.address === owner && param.page === 1))).returnsAsync(holderInventoryWithToken);
    service.setup(instance => instance.getTokenHolderInventoryPage(It.Is<{
        contractHash: string,
        address: string,
        page: number
    }>(param => param.contractHash === contractHash && param.address === anotherOwner && param.page === 1))).returnsAsync(emptyHolderInventory);
    return service.object();
}
