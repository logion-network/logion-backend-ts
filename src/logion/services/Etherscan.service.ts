import { injectable } from 'inversify';
import axios from 'axios';

@injectable()
export class EtherscanService {

    async getTokenHolderInventoryPage(parameters: {
        contractHash: string,
        tokenId: string,
    }): Promise<string> {
        const { contractHash, tokenId } = parameters;
        const response = await axios.get(`https://etherscan.io/token/generic-tokenholder-inventory?m=normal&contractAddress=${contractHash}&a=${tokenId}&pUrl=token`);
        return response.data;
    }
}
