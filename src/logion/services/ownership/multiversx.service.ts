import axios from "axios";
import { Log } from "@logion/rest-api-core";
import { injectable } from "inversify";
import { ValidAccountId } from "@logion/node-api";

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

    async isOwnerOf(account: ValidAccountId, tokenId: string): Promise<boolean> {
        if (account.type !== "Bech32") {
            return false;
        }
        try {
            const response = await axios.get(`https://${ this.host }.multiversx.com/accounts/${ account.address }/nfts/${ tokenId }?fields=balance,identifier,type`);
            const type = response.data.type;
            if (type) {
                if (type === "NonFungibleESDT") {
                    return true
                } else {
                    return Number(response.data.balance) > 0
                }
            }
        } catch (e) {
            logger.warn("Failed to fetch token %s for address %s: %s", tokenId, account.address, e);
        }
        return false;
    }

}
