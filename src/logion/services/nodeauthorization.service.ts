import { PolkadotService } from "./polkadot.service";
import { injectable } from "inversify";
import { PeerId } from "logion-api/dist/interfaces";
import { createFromB58String } from "peer-id";

@injectable()
export class NodeAuthorizationService {

    constructor(
        private polkadotService: PolkadotService
    ) {
    }

    async isWellKnownNode(base58PeerId: string): Promise<boolean> {
        const hexPeerId = createFromB58String(base58PeerId).toHexString();
        const api = await this.polkadotService.readyApi();
        const wellKnowNodes: Set<PeerId> = await api.query.nodeAuthorization.wellKnownNodes();
        for (let wellKnowNode of wellKnowNodes) {
            if (wellKnowNode.toHex() === `0x${ hexPeerId }`) {
                return true
            }
        }
        return false;
    }
}
