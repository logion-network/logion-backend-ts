import { injectable } from 'inversify';
import axios from 'axios';

export type NetworkType = 'mainnet' | 'goerli';

@injectable()
export class EtherscanService {

    async getTokenHolderInventoryPage(parameters: {
        network: NetworkType,
        contractHash: string,
        tokenId: string,
        page: number,
    }): Promise<string> {
        const { network, contractHash, tokenId, page } = parameters;
        const response = await axios.get(`https://${EtherscanService.HOSTNAMES[network]}/token/generic-tokenholder-inventory?m=normal&contractAddress=${contractHash}&a=${tokenId}&pUrl=token&p=${page}`);
        return response.data;
    }

    private static HOSTNAMES: Record<NetworkType, string> = {
        "mainnet": "etherscan.io",
        "goerli": "goerli.etherscan.io",
    };
}
