import { injectable } from "inversify";
import { Network, Alchemy, AlchemySettings, TokenBalance } from "alchemy-sdk";
import { ValidAccountId } from "@logion/node-api";

export { Network } from "alchemy-sdk";

@injectable()
export class AlchemyFactory {

    buildAlchemy(settings: AlchemySettings): Alchemy {
        return new Alchemy(settings);
    }
}

export class AlchemyChecker {

    constructor(alchemy: Alchemy) {
        this.alchemy = alchemy;
    }

    private alchemy: Alchemy;

    async getOwners(contractAddress: string, tokenId: string): Promise<ValidAccountId[]> {
        const response = await this.alchemy.nft.getOwnersForNft(contractAddress, tokenId);
        return response.owners.map(ValidAccountId.ethereum);
    }

    async getBalances(account: ValidAccountId, contractAddress: string): Promise<TokenBalance[]> {
        if (account.type !== "Ethereum") {
            return [];
        }
        const balances = await this.alchemy.core.getTokenBalances(account.address, [contractAddress]);
        return balances.tokenBalances;
    }
}

@injectable()
export class AlchemyService {

    constructor(factory: AlchemyFactory) {
        this.apiKeys = {};
        if(process.env.GOERLI_ALCHEMY_KEY) {
            this.apiKeys[Network.ETH_SEPOLIA] = process.env.GOERLI_ALCHEMY_KEY;
        }
        if(process.env.ETHEREUM_ALCHEMY_KEY) {
            this.apiKeys[Network.ETH_MAINNET] = process.env.ETHEREUM_ALCHEMY_KEY;
        }
        if(process.env.POLYGON_MUMBAI_ALCHEMY_KEY) {
            this.apiKeys[Network.MATIC_AMOY] = process.env.POLYGON_MUMBAI_ALCHEMY_KEY;
        }
        if(process.env.POLYGON_MAINNET_ALCHEMY_KEY) {
            this.apiKeys[Network.MATIC_MAINNET] = process.env.POLYGON_MAINNET_ALCHEMY_KEY;
        }
        this.factory = factory;
    }

    private readonly apiKeys: Partial<Record<Network, string>>;

    private factory: AlchemyFactory;

    getChecker(network: Network): AlchemyChecker {
        const settings = this.buildSettings(network);
        const alchemy = this.factory.buildAlchemy(settings);
        return new AlchemyChecker(alchemy);
    }

    private buildSettings(network: Network): AlchemySettings {
        const apiKey = this.apiKeys[network];
        if(!apiKey) {
            throw new Error(`No API key configured for network ${network}`);
        }
        return {
            apiKey,
            network,
        };
    }
}
