import { decimalToUuid } from "../../../src/logion/lib/uuid";

describe("decimalToUuid", () => {

    it("generates valid UUID if hex has leading zero", () => {
        const uuid = decimalToUuid("9834303291952213631156234438740495902");
        expect(uuid).toBe("07660496-5a8d-49e3-a2df-9828f16b4e1e");
    })
})
