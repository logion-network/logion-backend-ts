import { NodeAuthorizationService } from "../../../src/logion/services/nodeauthorization.service";
import { PolkadotService } from "../../../src/logion/services/polkadot.service";
import { Mock } from "moq.ts";
import { ApiPromise } from "@polkadot/api";
import { PeerId } from "logion-api/dist/interfaces";
import { createFromB58String } from "peer-id";

const WELL_KNOWN_NODES: string[] = ["12D3KooWBmAwcd4PJNJvfV89HwE48nwkRmAgo8Vy3uQEyNNHBox2", "12D3KooWQYV9dGMFoRzNStwpXztXaBUjtPqi6aU76ZgUriHhKust"]

describe("nodeAuthorizationService ", () => {

    const nodeAuthorizationService = new NodeAuthorizationService(mockPolkadotService())

    it(" does detect a well known node", async () => {
        const peerId = WELL_KNOWN_NODES[0]
        expect(await nodeAuthorizationService.isWellKnownNode(peerId)).toBeTrue()
    })

    it(" does not detect a random peer id as well known node", async () => {
        const peerId = "12D3KooWDCuGU7WY3VaWjBS1E44x4EnmTgK3HRxWFqYG3dqXDfP1"
        expect(await nodeAuthorizationService.isWellKnownNode(peerId)).toBeFalse()
    })
})

function mockPolkadotService(): PolkadotService {
    const api = mockApi();
    const polkadotService = new Mock<PolkadotService>();
    polkadotService.setup(instance => instance.readyApi())
        .returns(Promise.resolve(api));
    return polkadotService.object();
}

function peerId(base58PeerId: string): PeerId {
    const hexPeerId = createFromB58String(base58PeerId).toHexString();
    const peerId = new Mock<PeerId>()
    peerId.setup(instance => instance.toHex())
        .returns(`0x${hexPeerId}`)
    return peerId.object();
}

function mockApi(): ApiPromise {

    const apiMock: unknown = {
        query: {
            nodeAuthorization: {
                wellKnownNodes: () => new Set<PeerId>(WELL_KNOWN_NODES.map(peerId))
            }
        }
    };
    return apiMock as ApiPromise;
}

