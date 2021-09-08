import jwt, { JwtPayload } from 'jsonwebtoken';
import { ALICE } from "../../src/logion/model/addresses.model";

const SECRET = "secret-key-that-no-one-could-possibly-know";
const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE2MjM2NzQwOTksImV4cCI6MTgyMzY3NDA5OSwibGVnYWxPZmZpY2VyIjp0cnVlLCJpc3MiOiJ3d3cuZXhhbXBsZS5vcmciLCJzdWIiOiI1R3J3dmFFRjV6WGIyNkZ6OXJjUXBEV1M1N0N0RVJIcE5laFhDUGNOb0hHS3V0UVkifQ.yoaRk0oSixyYIztFDS5QCRop-0xAP_xw4UY30uTwVtM";
const ISSUER = "www.example.org";

// HEADER
// {
//     "alg": "HS256",
//     "typ": "JWT"
// }
// PAYLOAD
// {
//     "iat": 1623674099,
//     "exp": 1823674099,
//     "legalOfficer": true,
//     "iss": "www.example.org",
//     "sub": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"
// }
describe('jwt tests', () => {

    it("signs successfully", () => {
        const payload = {
            iat: 1623674099,
            exp: 1823674099,
            legalOfficer: true
        };
        const encoded = jwt.sign(payload, Buffer.from(SECRET, 'base64'), {
            algorithm: "HS256",
            issuer: ISSUER,
            subject: ALICE,
        })
        expect(encoded).toBe(TOKEN);
    })

    it("decodes successfully", () => {
        const payload = jwt.decode(TOKEN) as JwtPayload;
        console.log(payload);
        expect(payload!.iss).toBe(ISSUER);
        expect(payload!.sub).toBe(ALICE);
        expect(payload!.legalOfficer).toBe(true);
    })

    it("verifies the signature", () => {
        jwt.verify(TOKEN, Buffer.from(SECRET, 'base64'), {
            issuer: ISSUER,
            subject: ALICE
        })
    })

    it ("prevents fake token", () => {
        jwt.verify(TOKEN, Buffer.from("wrong-secret", 'base64'), (error, decoded) => {
            expect(error?.message).toBe("invalid signature");
        });
    })
})
