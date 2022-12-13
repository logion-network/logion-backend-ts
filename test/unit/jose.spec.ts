import { ALICE } from "../helpers/addresses.js";
import PeerId from "peer-id";
import { createPublicKey, KeyObject, createPrivateKey } from "crypto";
import { base64url, SignJWT, jwtVerify, decodeJwt } from "jose";

const NODE_1_PEER_ID = PeerId.createFromB58String("12D3KooWDCuGU7WY3VaWjBS1E44x4EnmTgK3HRxWFqYG3dqXDfP1");
const NODE_1_KEY = "1c482e5368b84abe08e1a27d0670d303351989b3aa281cb1abfc2f48e4530b57";

const ANOTHER_NODE_PEER_ID = PeerId.createFromB58String("12D3KooWE6cKjo2QTQqFNJFG7ymfndXrY3vZa7kaMgGHPDKmdP9F");

const TOKEN = "eyJhbGciOiJFZERTQSJ9.eyJpYXQiOjE2MjM2NzQwOTksImV4cCI6MTgyMzY3NDA5OSwiaXNzIjoiMTJEM0tvb1dEQ3VHVTdXWTNWYVdqQlMxRTQ0eDRFbm1UZ0szSFJ4V0ZxWUczZHFYRGZQMSIsInN1YiI6IjVHcnd2YUVGNXpYYjI2Rno5cmNRcERXUzU3Q3RFUkhwTmVoWENQY05vSEdLdXRRWSJ9.GggMsAlDO2GoRFm8IBxuHKVtZ7Ms1pipCTzzoaDbGxXGhm4niFX_kEetMVdXo69oG0vI7XWfWHs7Z-x-nOjUCQ";
const ALGORITHM = "EdDSA";

describe('jwt ', () => {

    function publicKey(peerId: PeerId): KeyObject {

        const publicKeyBytes = peerId.pubKey.bytes.slice(4, 36)

        return  createPublicKey({
            key: {
                kty: "OKP",
                crv: "Ed25519",
                x: base64url.encode(publicKeyBytes)
            },
            format: "jwk"
        });

    }

    function privateKey(peerId: PeerId, nodeKey: string): KeyObject {
        const publicKeyBytes = peerId.pubKey.bytes.slice(4, 36)
        const privateKeyBytes = Buffer.from(nodeKey, "hex");

        return  createPrivateKey({
            key: {
                kty: "OKP",
                crv: "Ed25519",
                x: base64url.encode(publicKeyBytes),
                d: base64url.encode(privateKeyBytes),
            },
            format: "jwk"
        })
    }

    it("signs successfully", async () => {
        const token = await new SignJWT({})
            .setProtectedHeader({alg: ALGORITHM})
            .setIssuedAt(1623674099)
            .setExpirationTime(1823674099)
            .setIssuer(NODE_1_PEER_ID.toB58String())
            .setSubject(ALICE)
            .sign(privateKey(NODE_1_PEER_ID, NODE_1_KEY))
        expect(token).toBe(TOKEN);
    })

    it("decodes successfully", () => {
        const payload = decodeJwt(TOKEN)
        console.log(payload);
        expect(payload!.iss).toBe(NODE_1_PEER_ID.toB58String());
        expect(payload!.sub).toBe(ALICE);
    })

    it("verifies the signature", async () => {
        await jwtVerify(TOKEN, publicKey(NODE_1_PEER_ID), {
            issuer: NODE_1_PEER_ID.toB58String(),
            subject: ALICE,
            algorithms: [ ALGORITHM ]
        })
    })

    it ("prevents fake token", async () => {
        try {
            await jwtVerify(TOKEN, publicKey(ANOTHER_NODE_PEER_ID), {
                issuer: NODE_1_PEER_ID.toB58String(),
                subject: ALICE,
                algorithms: [ ALGORITHM ]
            })
            fail("Token verified with an invalid key")
        } catch (error) {
            expect("" + error).toEqual("JWSSignatureVerificationFailed: signature verification failed")
        }
    })
})
