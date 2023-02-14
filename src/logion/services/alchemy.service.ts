import { injectable } from "inversify";
import { Network, Alchemy, AlchemySettings } from "alchemy-sdk";

export { Network } from "alchemy-sdk";

@injectable()
export class AlchemyFactory {

    buildAlchemy(settings: AlchemySettings): Alchemy {
        return new Alchemy(settings);
    }
}

@injectable()
export class AlchemyService {

    constructor(factory: AlchemyFactory) {
        this.apiKeys = {};
        if(process.env.GOERLI_ALCHEMY_KEY) {
            this.apiKeys[Network.ETH_GOERLI] = process.env.GOERLI_ALCHEMY_KEY;
        }
        if(process.env.ETHEREUM_ALCHEMY_KEY) {
            this.apiKeys[Network.ETH_MAINNET] = process.env.ETHEREUM_ALCHEMY_KEY;
        }
        if(process.env.POLYGON_MUMBAI_ALCHEMY_KEY) {
            this.apiKeys[Network.MATIC_MUMBAI] = process.env.POLYGON_MUMBAI_ALCHEMY_KEY;
        }
        if(process.env.POLYGON_MAINNET_ALCHEMY_KEY) {
            this.apiKeys[Network.MATIC_MAINNET] = process.env.POLYGON_MAINNET_ALCHEMY_KEY;
        }
        this.factory = factory;
    }

    private readonly apiKeys: Partial<Record<Network, string>>;

    private factory: AlchemyFactory;

    async getOwners(network: Network, contractAddress: string, tokenId: string): Promise<string[]> {
        const alchemy = this.factory.buildAlchemy(this.buildSettings(network));
        const response = await alchemy.nft.getOwnersForNft(contractAddress, tokenId);
        return response.owners;
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
