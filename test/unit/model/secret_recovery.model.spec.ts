import { SecretRecoveryRequestFactory } from "../../../src/logion/model/secret_recovery.model.js";
import moment from "moment";
import { ALICE_ACCOUNT } from "../../helpers/addresses.js";

describe("SecretRecoveryRequestFactory", () => {

    it("creates a request", () => {
        const factory = new SecretRecoveryRequestFactory();

        const userIdentity = {
            email: "john.doe@logion.network",
            firstName: "John",
            lastName: "Doe",
            phoneNumber: "+1234",
        };
        const userPostalAddress = {
            line1: "Place de le République Française, 10",
            line2: "boite 15",
            postalCode: "4000",
            city: "Liège",
            country: "Belgium",
        };

        const params = {
            requesterIdentityLocId: "fd61e638-4af0-4ced-b018-4f1c31a91e6e",
            secretName: "my-secret",
            challenge: "my-challenge",
            createdOn: moment(),
            userIdentity,
            userPostalAddress,
            legalOfficerAddress: ALICE_ACCOUNT,
        }
        const secretRecoveryRequest = factory.newSecretRecoveryRequest(params);
        expect(secretRecoveryRequest.id).toBeDefined();
        expect(secretRecoveryRequest.getDescription().userIdentity).toEqual(params.userIdentity);
        expect(secretRecoveryRequest.getDescription().userPostalAddress).toEqual(params.userPostalAddress);
        expect(secretRecoveryRequest.getDescription().challenge).toEqual(params.challenge);
        expect(secretRecoveryRequest.getDescription().secretName).toEqual(params.secretName);
        expect(secretRecoveryRequest.getDescription().requesterIdentityLocId).toEqual(params.requesterIdentityLocId);
    })
})
