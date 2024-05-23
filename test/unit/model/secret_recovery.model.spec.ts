import { SecretRecoveryRequestAggregateRoot, SecretRecoveryRequestFactory } from "../../../src/logion/model/secret_recovery.model.js";
import moment from "moment";
import { ALICE_ACCOUNT } from "../../helpers/addresses.js";
import { LegalOfficerDecision } from "../../../src/logion/model/decision.js";

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
            id: "a7ff4ab6-5bef-4310-9c28-bcbd653565c3",
            requesterIdentityLocId: "fd61e638-4af0-4ced-b018-4f1c31a91e6e",
            secretName: "my-secret",
            challenge: "my-challenge",
            createdOn: moment(),
            userIdentity,
            userPostalAddress,
            legalOfficerAddress: ALICE_ACCOUNT,
        }
        const secretRecoveryRequest = factory.newSecretRecoveryRequest(params);
        expect(secretRecoveryRequest.getDescription().id).toBe(params.id);
        expect(secretRecoveryRequest.getDescription().status).toBe("PENDING");
        expect(secretRecoveryRequest.getDescription().userIdentity).toEqual(params.userIdentity);
        expect(secretRecoveryRequest.getDescription().userPostalAddress).toEqual(params.userPostalAddress);
        expect(secretRecoveryRequest.getDescription().challenge).toEqual(params.challenge);
        expect(secretRecoveryRequest.getDescription().secretName).toEqual(params.secretName);
        expect(secretRecoveryRequest.getDescription().requesterIdentityLocId).toEqual(params.requesterIdentityLocId);
    })
})

describe("SecretRecoveryRequestAggregateRoot", () => {

    it("accepts", () => {
        const request = new SecretRecoveryRequestAggregateRoot();
        request.status = "PENDING";
        request.decision = new LegalOfficerDecision();

        request.accept(moment());

        expect(request.status).toBe("ACCEPTED");
        const decision = request.decision;
        expect(decision?.decisionOn).toBeDefined();
    })

    it("rejects", () => {
        const request = new SecretRecoveryRequestAggregateRoot();
        request.status = "PENDING";
        request.decision = new LegalOfficerDecision();

        request.reject("Because.", moment());

        expect(request.status).toBe("REJECTED");
        const decision = request.decision;
        expect(decision?.decisionOn).toBeDefined();
        expect(decision?.rejectReason).toBe("Because.");
    })
})
