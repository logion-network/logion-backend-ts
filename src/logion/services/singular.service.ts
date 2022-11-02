import { injectable } from 'inversify';
import axios from "axios";

@injectable()
export class SingularService {

    async getOwners(nftId: string): Promise<string[]> {
        const response = await axios.get(`https://singular.app/api/nft/${nftId}`);
        return response.data.nfts.map((nft: any) => nft.owner);
    }
}
