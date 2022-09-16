import { PersonalInfoSealService } from "../../../src/logion/services/seal.service";
import { UserIdentity } from "../../../src/logion/model/useridentity";
import { PostalAddress } from "../../../src/logion/model/postaladdress";
import { PersonalInfo } from "../../../src/logion/model/personalinfo.model";

describe("UserIdentitySealService", () => {

    const sealService = new PersonalInfoSealService();

    const userIdentity: UserIdentity = {
        firstName: "Scott",
        lastName: "Tiger",
        phoneNumber: "123",
        email: "scott.tiger@example.org"
    }

    const userPostalAddress: PostalAddress = {
        line1: "Rue de la Paix",
        line2: "",
        postalCode: "4000",
        city: "Liège",
        country: "Belgium"
    }

    const personalInfo: PersonalInfo = {
        userIdentity,
        userPostalAddress
    }

    const salt = "aa456085-5344-4937-b3be-559489366be6";

    const hash = "0x90e6d447523780d1a048194b939fa95587e52c01b82bf5683b3801729e300c36";

    it("seals with salt", () => {
        const seal = sealService.seal(
            personalInfo,
            salt
        );
        expect(seal.hash).toEqual(hash)
        expect(seal.salt).toEqual(salt)
    })

    it("verifies", () => {
        expect(sealService.verify(
            personalInfo,
            { hash, salt })
        ).toBeTrue();
    })

    it("fails to verify wrong hash", () => {
        const wrongHash = "0xab60bc976540a41f830c29c64db4c8442f20724437a078d309f42a958b29af07";
        expect(sealService.verify(
            personalInfo,
            { hash: wrongHash, salt })
        ).toBeFalse();
    })

    it("fails to verify wrong salt", () => {
        expect(sealService.verify(
            personalInfo,
            { hash, salt: "pepper" })
        ).toBeFalse();
    })

    it("verifies with generated salt", () => {
        const seal = sealService.seal(personalInfo);
        expect(sealService.verify(personalInfo, seal));
    })
})
