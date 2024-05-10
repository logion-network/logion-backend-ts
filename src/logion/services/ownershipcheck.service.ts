import { injectable } from 'inversify';

import { Network, AlchemyService, AlchemyChecker } from './ownership/alchemy.service.js';
import { SingularService } from './ownership/singular.service.js';
import { BigNumber } from 'alchemy-sdk';
import { MultiversxService } from "./ownership/multiversx.service.js";
import { CollectionItemTokenDescription } from '../model/collection.model.js';
import { AstarNetwork, AstarService, AstarTokenId, AstarTokenType } from './ownership/astar.service.js';
import { ValidAccountId } from "@logion/node-api";

@injectable()
export class OwnershipCheckService {

    constructor(
        private alchemyService: AlchemyService,
        private singularService: SingularService,
        private multiversxService: MultiversxService,
        private astarService: AstarService,
    ) {}

    async isOwner(account: ValidAccountId, token: CollectionItemTokenDescription): Promise<boolean> {
        const tokenType = token.type;
        const tokenId = token.id;
        if(!tokenId || !tokenType) {
            return false;
        } else if(this.isAlchemyNetwork(tokenType)) {
            const network = this.getNetwork(tokenType);
            const checker = this.alchemyService.getChecker(network);
            if(tokenType.includes("erc721") || tokenType.includes("erc1155")) {
                return this.isOwnerOfErc721OrErc1155(checker, account, tokenId);
            } else if(tokenType.includes("erc20")) {
                return this.isOwnerOfErc20(checker, account, tokenId);
            } else {
                throw new Error(`Unsupported Alchemy token ${tokenType}`);
            }
        } else if(tokenType === 'owner') {
            const owner = ValidAccountId.fromUnknown(tokenId)
            return account.equals(owner);
        } else if(tokenType === 'singular_kusama') {
            return this.isOwnerOfSingularKusama(account, tokenId);
        } else if(tokenType.startsWith("multiversx")) {
            const checker = this.multiversxService.getChecker(tokenType);
            if (checker) {
                return checker.isOwnerOf(account, token.id);
            } else {
                throw new Error(`Unsupported MultiversX token ${tokenType}`);
            }
        } else if(tokenType.startsWith("astar")) {
            const network = this.getAstarNetwork(tokenType);
            const contractTokenType = this.getAstarTokenType(tokenType);
            const { contractHash, contractTokenId } = this.parseAstarTokenId(tokenId);
            const client = await this.astarService.getClient(network, contractTokenType, contractHash);
            const owner = await client.getOwnerOf(contractTokenId);
            await client.disconnect();
            return account.equals(owner);
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
            return Network.ETH_SEPOLIA;
        } else if(tokenType.startsWith("polygon_mumbai_")) {
            return Network.MATIC_AMOY;
        } else if(tokenType.startsWith("polygon_")) {
            return Network.MATIC_MAINNET;
        } else {
            throw new Error(`Could not get Alchemy network from token type ${tokenType}`);
        }
    }

    private async isOwnerOfErc721OrErc1155(checker: AlchemyChecker, account: ValidAccountId, itemTokenId: string): Promise<boolean> {
        if (account.type !== "Ethereum") {
            return false;
        }
        const { contractHash, contractTokenId: tokenId } = this.parseErc721Or1155TokenId(itemTokenId);
        const owners = await checker.getOwners(contractHash, tokenId);
        return owners.find(owner => account.equals(owner)) !== undefined;
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

    private async isOwnerOfErc20(checker: AlchemyChecker, account: ValidAccountId, itemTokenId: string): Promise<boolean> {
        if (account.type !== "Ethereum") {
            return false;
        }
        const { contractHash } = this.parseErc20TokenId(itemTokenId);
        const balances = await checker.getBalances(account, contractHash);
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

    private async isOwnerOfSingularKusama(account: ValidAccountId, tokenId: string): Promise<boolean> {
        const owners = await this.singularService.getOwners(tokenId);
        return owners.find(owner => owner.equals(account)) !== undefined;
    }

    private getAstarNetwork(tokenType: string): AstarNetwork {
        if(tokenType.startsWith("astar_shiden_")) {
            return "shiden";
        } else if(tokenType.startsWith("astar_shibuya_")) {
            return "shibuya";
        } else if(tokenType.startsWith("astar_")) {
            return "astar";
        } else {
            throw new Error(`Could not get Astar network from token type ${tokenType}`);
        }
    }

    private parseAstarTokenId(tokenId: string): { contractHash: string, contractTokenId: AstarTokenId } {
        let tokenIdObject;
        try {
            tokenIdObject = JSON.parse(tokenId);
        } catch(e) {
            throw new Error("Token ID is not a valid JSON");
        }
        const contractHash = tokenIdObject.contract;
        const contractTokenId = tokenIdObject.id;
        if(typeof contractHash !== "string" || typeof contractTokenId !== "object") {
            throw new Error("Token ID has wrong schema");
        } else {
            return { contractHash, contractTokenId };
        }
    }

    private getAstarTokenType(tokenType: string): AstarTokenType {
        if(tokenType.includes("psp34")) {
            return "psp34";
        } else {
            throw new Error(`Could not get Astar token type from ${tokenType}`);
        }
    }
}
