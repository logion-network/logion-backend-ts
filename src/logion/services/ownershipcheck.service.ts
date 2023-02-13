import { injectable } from 'inversify';
import { ItemToken, CollectionItem } from '@logion/node-api';

import { Network, AlchemyService } from './alchemy.service.js';
import { SingularService } from './singular.service.js';

@injectable()
export class OwnershipCheckService {

    constructor(
        private alchemyService: AlchemyService,
        private singularService: SingularService,
    ) {}

    async isOwner(address: string, item: CollectionItem): Promise<boolean> {
        const normalizedAddress = address.toLowerCase();
        if(!item.restrictedDelivery) {
            return true;
        } else {
            if(!item.token) {
                throw new Error("Item with restricted delivery but no token defined");
            } else {
                const tokenType = item.token.type;
                if(tokenType === 'ethereum_erc721' || tokenType === 'ethereum_erc1155') {
                    return this.isOwnerOfErc721OrErc1155(Network.ETH_MAINNET, normalizedAddress, item.token);
                } else if(tokenType === 'goerli_erc721' || tokenType === 'goerli_erc1155') {
                    return this.isOwnerOfErc721OrErc1155(Network.ETH_GOERLI, normalizedAddress, item.token);
                } else if(tokenType === 'polygon_erc721' || tokenType === 'polygon_erc1155') {
                    return this.isOwnerOfErc721OrErc1155(Network.MATIC_MAINNET, normalizedAddress, item.token);
                } else if(tokenType === 'polygon_mumbai_erc721' || tokenType === 'polygon_mumbai_erc1155') {
                    return this.isOwnerOfErc721OrErc1155(Network.MATIC_MUMBAI, normalizedAddress, item.token);
                } else if(tokenType === 'owner') {
                    return normalizedAddress === item.token.id.toLowerCase();
                } else if(tokenType === 'singular_kusama') {
                    return this.isOwnerOfSingularKusama(address, item.token.id);
                } else {
                    throw new Error(`Unsupported token type ${tokenType}`);
                }
            }
        }
    }

    private async isOwnerOfErc721OrErc1155(network: Network, address: string, token: ItemToken): Promise<boolean> {
        const { contractHash, contractTokenId: tokenId } = this.parseErc721Or1155TokenId(token.id);
        const owners = await this.alchemyService.getOwners(network, contractHash, tokenId);
        return owners.find(owner => owner.toLowerCase() === address) !== undefined;
    }

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

    private async isOwnerOfSingularKusama(address: string, tokenId: string): Promise<boolean> {
        const owners = await this.singularService.getOwners(tokenId);
        return owners.find(owner => owner === address) !== undefined;
    }
}
