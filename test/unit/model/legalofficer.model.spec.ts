import { LegalOfficerFactory, LegalOfficerDescription } from "../../../src/logion/model/legalofficer.model.js";
import { LEGAL_OFFICERS } from "../../helpers/addresses.js";
import { DB_SS58_PREFIX } from "../../../src/logion/model/supportedaccountid.model.js";

describe("LegalOfficerFactory", () => {

    let factory: LegalOfficerFactory = new LegalOfficerFactory();

    it("succeeds to create a LegalOfficerAggregateRoot", async () => {

        LEGAL_OFFICERS.forEach(legalOfficer => {
            testNewLegalOfficer(legalOfficer)
        })
    })

    function testNewLegalOfficer(legalOfficer: LegalOfficerDescription) {
        let aggregate = factory.newLegalOfficer(legalOfficer)
        expect(aggregate.address).toBe(legalOfficer.account.getAddress(DB_SS58_PREFIX));
        expect(aggregate.getDescription().userIdentity).toEqual(legalOfficer.userIdentity);
        expect(aggregate.getDescription().postalAddress).toEqual(legalOfficer.postalAddress);
        expect(aggregate.getDescription().additionalDetails).toEqual(legalOfficer.additionalDetails);
    }
})
