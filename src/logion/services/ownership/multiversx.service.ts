import axios from "axios";
import { Log } from "@logion/rest-api-core";
import { injectable } from "inversify";

export type MultiversxTokenType =
    'multiversx_devnet_esdt' |
    'multiversx_testnet_esdt' |
    'multiversx_esdt';

const { logger } = Log;

@injectable()
export class MultiversxService {

    readonly checkerMap: Record<MultiversxTokenType | string, MultiversxChecker> = {
        multiversx_devnet_esdt: new MultiversxChecker("devnet-api"),
        multiversx_testnet_esdt: new MultiversxChecker("testnet-api"),
        multiversx_esdt: new MultiversxChecker("api"),
    }

    getChecker(tokenType: MultiversxTokenType | string): MultiversxChecker | undefined {
        return this.checkerMap[tokenType];
    }
}

export class MultiversxChecker {

    constructor(host: string) {
        this.host = host;
    }

    readonly host: string;

    async isOwnerOf(address: string, tokenId: string): Promise<boolean> {
        try {
            const response = await axios.get(`https://${ this.host }.multiversx.com/accounts/${ address }/nfts/${ tokenId }?fields=balance,identifier,type`);
            const type = response.data.type;
            if (type) {
                if (type === "NonFungibleESDT") {
                    return true
                } else {
                    return Number(response.data.balance) > 0
                }
            }
        } catch (e) {
            logger.warn("Failed to fetch token %s for address %s: %s", tokenId, address, e);
        }
        return false;
    }

}
