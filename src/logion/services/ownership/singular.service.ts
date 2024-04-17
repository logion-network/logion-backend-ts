import { injectable } from 'inversify';
import { ValidAccountId } from "@logion/node-api";
import axios from "axios";

@injectable()
export class SingularService {

    /**
     * Retrieve owners of a nft on singular.
     * @param nftId the id of the nft
     * @return an array of addresses, converted to Substrate format (prefix 42)
     */
    async getOwners(nftId: string): Promise<ValidAccountId[]> {
        const response = await axios.get(`https://singular.app/api/nft/${nftId}`);
        return response.data.nfts.map((nft: any) => ValidAccountId.polkadot(nft.owner)); // eslint-disable-line @typescript-eslint/no-explicit-any
    }
}
