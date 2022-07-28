import { injectable } from 'inversify';
import { ItemToken } from '@logion/node-api';
import { CollectionItem } from '@logion/node-api/dist/Types';

import { EtherscanScrapper } from './etherscanscrapper';
import { EtherscanService } from './Etherscan.service';

@injectable()
export class OwnershipCheckService {

    constructor(
        private etherscanService: EtherscanService,
    ) {}

    async isOwner(address: string, item: CollectionItem): Promise<boolean> {
        if(!item.restrictedDelivery) {
            return true;
        } else {
            if(!item.token) {
                throw new Error("Item with restricted delivery but no token defined");
            } else {
                const tokenType = item.token.type;
                if(tokenType === 'ethereum_erc721') {
                    return this.isOwnerOfEthereumErc721(address, item.token);
                } else {
                    throw new Error(`Unsupported token type ${tokenType}`);
                }
            }
        }
    }

    private async isOwnerOfEthereumErc721(address: string, token: ItemToken): Promise<boolean> {
        const { contractHash, contractTokenId } = this.parseEthereumErc721TokenId(token.id);
        let page = 1;
        let lastPage = 1;
        do {
            const inventoryPage = await this.etherscanService.getTokenHolderInventoryPage({
                contractHash,
                address,
                page,
            });
            const scrapper = new EtherscanScrapper(inventoryPage);
            if(page === 1) {
                lastPage = scrapper.getLastPage();
            }
            if(scrapper.isEmptyTokenHolderInventoryPage()) {
                return false;
            } else if(scrapper.tokenHolderInventoryPageContainsToken(contractHash, contractTokenId)) {
                return true;
            }
            ++page;
        } while(page <= lastPage);
        return false;
    }

    private parseEthereumErc721TokenId(tokenId: string): { contractHash: string, contractTokenId: string } {
        let tokenIdObject;
        try {
            tokenIdObject = JSON.parse(tokenId);
        } catch(e) {
            throw new Error("Token ID is not a valid JSON");
        }
        const contractHash = tokenIdObject.contract;
        const contractTokenId = tokenIdObject.id;
        if(typeof contractHash !== "string" || typeof contractTokenId !== "string") {
            throw new Error("Token ID has wrong schema");
        } else {
            return { contractHash, contractTokenId };
        }
    }
}
