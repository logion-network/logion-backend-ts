import { LATEST_SEAL_VERSION, PersonalInfoSealService } from "../../../src/logion/services/seal.service.js";
import { UserIdentity } from "../../../src/logion/model/useridentity.js";
import { PostalAddress } from "../../../src/logion/model/postaladdress.js";
import { PersonalInfo } from "../../../src/logion/model/personalinfo.model.js";
import { Hash } from "@logion/node-api";

describe("PersonalInfoSealService", () => {

    const sealService = new PersonalInfoSealService();

    const userIdentity: UserIdentity = {
        firstName: "Scott",
        lastName: "Tiger",
        phoneNumber: "123",
        email: "scott.tiger@example.org",
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
        userPostalAddress,
        company: "The Company I Represent",
    }

    const salt = "aa456085-5344-4937-b3be-559489366be6";

    const version = LATEST_SEAL_VERSION;

    const expectedHashesPerVersion = [
        Hash.fromHex("0x90e6d447523780d1a048194b939fa95587e52c01b82bf5683b3801729e300c36"),
        Hash.fromHex("0xa22772e11382ecc1cdcc6d776b0e6a8ed210aa0e19e6d2b83dce67c3868468e9"),
    ];

    it("seals with salt", () => {
        const seal = sealService.seal(
            personalInfo,
            version,
            salt,
        );
        expect(seal.hash).toEqual(expectedHashesPerVersion[version])
        expect(seal.salt).toEqual(salt)
    })

    it("verifies", () => {
        expect(sealService.verify(
            personalInfo,
            { hash: expectedHashesPerVersion[LATEST_SEAL_VERSION], salt, version })
        ).toBeTrue();
    })

    it("fails to verify wrong hash", () => {
        const wrongHash = Hash.fromHex("0xab60bc976540a41f830c29c64db4c8442f20724437a078d309f42a958b29af07");
        expect(sealService.verify(
            personalInfo,
            { hash: wrongHash, salt, version })
        ).toBeFalse();
    })

    it("fails to verify wrong salt", () => {
        expect(sealService.verify(
            personalInfo,
            { hash: expectedHashesPerVersion[LATEST_SEAL_VERSION], salt: "pepper", version })
        ).toBeFalse();
    })

    it("verifies with generated salt", () => {
        const seal = sealService.seal(personalInfo, version);
        expect(sealService.verify(personalInfo, seal));
    })

    it("is tested for all supported versions", () => {
        expect(expectedHashesPerVersion.length).toBe(LATEST_SEAL_VERSION + 1);
    })

    it("seals and verifies all supported versions", () => {
        for(let version = 0; version < expectedHashesPerVersion.length; ++version) {
            const seal = sealService.seal(
                personalInfo,
                version,
                salt,
            );
            expect(seal.hash).toEqual(expectedHashesPerVersion[version]);
            expect(sealService.verify(personalInfo, seal)).toBeTrue();
        }
    })
})
