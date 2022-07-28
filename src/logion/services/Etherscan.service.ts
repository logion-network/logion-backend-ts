import { injectable } from 'inversify';
import axios from 'axios';

@injectable()
export class EtherscanService {

    async getTokenHolderInventoryPage(parameters: {
        contractHash: string,
        address: string,
        page: number
    }): Promise<string> {
        const { contractHash, address, page } = parameters;
        const response = await axios.get(`https://etherscan.io/token/generic-tokenholder-inventory?m=normal&contractAddress=${contractHash}&a=${address}&pUrl=token&p=${page}`);
        return response.data;
    }
}
