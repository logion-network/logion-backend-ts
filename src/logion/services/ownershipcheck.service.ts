import { injectable } from 'inversify';

import { Network, AlchemyService, AlchemyChecker } from './alchemy.service.js';
import { SingularService } from './singular.service.js';
import { BigNumber } from 'alchemy-sdk';
import { MultiversxService } from "./multiversx.service.js";
import { CollectionItemTokenDescription } from '../model/collection.model.js';

@injectable()
export class OwnershipCheckService {

    constructor(
        private alchemyService: AlchemyService,
        private singularService: SingularService,
        private multiversxService: MultiversxService,
    ) {}

    async isOwner(address: string, token: CollectionItemTokenDescription): Promise<boolean> {
        const normalizedAddress = address.toLowerCase();
        const tokenType = token.type;
        const tokenId = token.id;
        if(!tokenId || !tokenType) {
            return false;
        } else if(this.isAlchemyNetwork(tokenType)) {
            const network = this.getNetwork(tokenType);
            const checker = this.alchemyService.getChecker(network);
            if(tokenType.includes("erc721") || tokenType.includes("erc1155")) {
                return this.isOwnerOfErc721OrErc1155(checker, normalizedAddress, tokenId);
            } else if(tokenType.includes("erc20")) {
                return this.isOwnerOfErc20(checker, normalizedAddress, tokenId);
            } else {
                throw new Error(`Unsupported Alchemy token ${tokenType}`);
            }
        } else if(tokenType === 'owner') {
            return normalizedAddress === token.id.toLowerCase();
        } else if(tokenType === 'singular_kusama') {
            return this.isOwnerOfSingularKusama(address, token.id);
        } else if(tokenType.startsWith("multiversx")) {
            const checker = this.multiversxService.getChecker(tokenType);
            if (checker) {
                return checker.isOwnerOf(normalizedAddress, token.id);
            } else {
                throw new Error(`Unsupported MultiversX token ${tokenType}`);
            }
        } else {
            throw new Error(`Unsupported token type ${tokenType}`);
        }
    }

    private isAlchemyNetwork(tokenType: string): boolean {
        return tokenType.includes("erc721") || tokenType.includes("erc1155") || tokenType.includes("erc20");
    }

    private getNetwork(tokenType: string): Network {
        if(tokenType.startsWith("ethereum_")) {
            return Network.ETH_MAINNET;
        } else if(tokenType.startsWith("goerli_")) {
            return Network.ETH_GOERLI;
        } else if(tokenType.startsWith("polygon_mumbai_")) {
            return Network.MATIC_MUMBAI;
        } else if(tokenType.startsWith("polygon_")) {
            return Network.MATIC_MAINNET;
        } else {
            throw new Error(`Could not get Alchemy network from token type ${tokenType}`);
        }
    }

    private async isOwnerOfErc721OrErc1155(checker: AlchemyChecker, address: string, itemTokenId: string): Promise<boolean> {
        const { contractHash, contractTokenId: tokenId } = this.parseErc721Or1155TokenId(itemTokenId);
        const owners = await checker.getOwners(contractHash, tokenId);
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

    private async isOwnerOfErc20(checker: AlchemyChecker, address: string, itemTokenId: string): Promise<boolean> {
        const { contractHash } = this.parseErc20TokenId(itemTokenId);
        const balances = await checker.getBalances(address, contractHash);
        const balance = balances.find(balance => balance.contractAddress === contractHash && !balance.error);
        return balance !== undefined && balance.tokenBalance !== null && !BigNumber.from(balance.tokenBalance).isZero();
    }

    private parseErc20TokenId(tokenId: string): { contractHash: string } {
        let tokenIdObject;
        try {
            tokenIdObject = JSON.parse(tokenId);
        } catch(e) {
            throw new Error("Token ID is not a valid JSON");
        }
        const contractHash = tokenIdObject.contract;
        if(typeof contractHash !== "string") {
            throw new Error("Token ID has wrong schema");
        } else {
            return { contractHash };
        }
    }

    private async isOwnerOfSingularKusama(address: string, tokenId: string): Promise<boolean> {
        const owners = await this.singularService.getOwners(tokenId);
        return owners.find(owner => owner === address) !== undefined;
    }
}
