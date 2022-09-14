import { SealService, UserIdentitySealService } from "../../../src/logion/services/seal.service";
import { UserIdentity } from "../../../src/logion/model/useridentity";

describe("UserIdentitySealService", () => {

    const sealService: SealService<UserIdentity> = new UserIdentitySealService();

    const userIdentity: UserIdentity = {
        firstName: "Scott",
        lastName: "Tiger",
        phoneNumber: "123",
        email: "scott.tiger@example.org"
    }

    const salt = "aa456085-5344-4937-b3be-559489366be6";

    const hash = "0xe5503e3765f8b78a38eb138b78d6c6a1a118b6abbebf331f23db8c75e3fa831a";

    it("seals with salt", () => {
        const seal = sealService.seal(
            userIdentity,
            salt
        );
        expect(seal.hash).toEqual(hash)
        expect(seal.salt).toEqual(salt)
    })

    it("verifies", () => {
        expect(sealService.verify(
            userIdentity,
            { hash, salt })
        ).toBeTrue();
    })

    it("fails to verify wrong hash", () => {
        const wrongHash = "0xab60bc976540a41f830c29c64db4c8442f20724437a078d309f42a958b29af07";
        expect(sealService.verify(
            userIdentity,
            { hash: wrongHash, salt })
        ).toBeFalse();
    })

    it("fails to verify wrong salt", () => {
        expect(sealService.verify(
            userIdentity,
            { hash, salt: "pepper" })
        ).toBeFalse();
    })

    it("verifies with generated salt", () => {
        const seal = sealService.seal(userIdentity);
        expect(sealService.verify(userIdentity, seal));
    })
})
