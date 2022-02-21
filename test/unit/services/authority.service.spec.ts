import { AuthorityService } from "../../../src/logion/services/authority.service";
import { PolkadotService } from "../../../src/logion/services/polkadot.service";
import { Mock } from "moq.ts";
import { ApiPromise } from "@polkadot/api";
import { bool, Option } from "@polkadot/types-codec";

describe("authority service", () => {

    it("succeeds with legal officer", async () => {
        const polkadotService = mockPolkadotServiceWithLegalOfficer("abc");
        const authorityService = new AuthorityService(polkadotService);
        expect(await authorityService.isLegalOfficer("abc")).toBe(true);
    })

    it("fails for a non-legal officer", async () => {
        const polkadotService = mockPolkadotServiceWithLegalOfficer("abc");
        const authorityService = new AuthorityService(polkadotService);
        expect(await authorityService.isLegalOfficer("abd")).toBe(false);
    })
})

function mockPolkadotServiceWithLegalOfficer(expectedAddress: string): PolkadotService {
    const api = mockApi(expectedAddress);
    const polkadotService = new Mock<PolkadotService>();
    polkadotService.setup(instance => instance.readyApi())
        .returns(Promise.resolve(api));
    return polkadotService.object();
}

function mockApi(expectedAddress: string): ApiPromise {
    const apiMock: unknown = {
        query: {
            loAuthorityList: {
                legalOfficerSet: (address: string) => address === expectedAddress ? mockOptionBool(true, true) : mockOptionBool(false)
            }
        }
    };

    return apiMock as ApiPromise;
}

function mockOptionBool(isSome: boolean, isTrue?: boolean): Option<bool> {
    if(isSome) {
        const optionMock: unknown = {
            isSome,
            unwrap: () => {
                return {
                    isTrue: isTrue!
                };
            }
        }
        return optionMock as Option<bool>;
    } else {
        const optionMock: unknown = {
            isSome,
            unwrap: () => { throw new Error() }
        }
        return optionMock as Option<bool>;
    }
}
