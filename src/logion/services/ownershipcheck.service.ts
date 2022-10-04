import { injectable } from 'inversify';
import { ItemToken } from '@logion/node-api';
import { CollectionItem } from '@logion/node-api/dist/Types';

import { EtherscanScrapper } from './etherscanscrapper';
import { EtherscanService, NetworkType } from './Etherscan.service';

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
                if(tokenType === 'ethereum_erc721' || tokenType === 'ethereum_erc1155') {
                    return this.isOwnerOfErc721OrErc1155('mainnet', address, item.token);
                } else if(tokenType === 'goerli_erc721' || tokenType === 'goerli_erc1155') {
                    return this.isOwnerOfErc721OrErc1155('goerli', address, item.token);
                } else if(tokenType === 'owner') {
                    return address.toLowerCase() === item.token.id.toLowerCase();
                } else {
                    throw new Error(`Unsupported token type ${tokenType}`);
                }
            }
        }
    }

    private async isOwnerOfErc721OrErc1155(network: NetworkType, address: string, token: ItemToken): Promise<boolean> {
        const { contractHash, contractTokenId: tokenId } = this.parseErc721Or1155TokenId(token.id);
        let page = 1;
        while(page < OwnershipCheckService.MAX_PAGES) {
            const inventoryPage = await this.etherscanService.getTokenHolderInventoryPage({
                network,
                contractHash,
                tokenId,
                page,
            });

            const scrapper = new EtherscanScrapper(inventoryPage);
            if(scrapper.tokenHolderInventoryPageContainsHolder(address)) {
                return true;
            } else if(scrapper.isEmptyPage()) {
                return false;
            }

            ++page;
        }

        return false;
    }

    private static MAX_PAGES = 100;

    private parseErc721Or1155TokenId(tokenId: string): { contractHash: string, contractTokenId: string } {
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
