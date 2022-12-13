import { LoFileFactory, LoFileAggregateRoot, LoFileDescription } from "../../../src/logion/model/lofile.model.js";
import { ALICE } from "../../helpers/addresses.js";

describe("LO File model", () => {

    const description: LoFileDescription = {
        id: "sof-header",
        legalOfficerAddress: ALICE,
        contentType: "image/png",
        oid: 123,
    };

    it("creates a new aggregate root", () => {
        const factory = new LoFileFactory();
        const loFileAggregateRoot = factory.newLoFile(description);
        expect(loFileAggregateRoot.id).toEqual(description.id);
        expect(loFileAggregateRoot.contentType).toEqual(description.contentType);
        expect(loFileAggregateRoot.oid).toEqual(description.oid);
    })

    it("updates an aggregate root", () => {
        const loFileAggregateRoot = new LoFileAggregateRoot();
        loFileAggregateRoot.id = description.id;
        loFileAggregateRoot.contentType = description.contentType;
        loFileAggregateRoot.id = description.id;
        loFileAggregateRoot.update({
            contentType: "application/pdf",
            oid: 456
        })
        expect(loFileAggregateRoot.id).toEqual(description.id);
        expect(loFileAggregateRoot.contentType).toEqual("application/pdf");
        expect(loFileAggregateRoot.oid).toEqual(456);
    });
})
