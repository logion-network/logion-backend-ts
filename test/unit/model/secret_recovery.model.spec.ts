import { SECRET_EXPIRATION_DAYS, SecretRecoveryRequestAggregateRoot, SecretRecoveryRequestFactory, SecretRecoveryRequestStatus } from "../../../src/logion/model/secret_recovery.model.js";
import moment, { Moment } from "moment";
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
        expect(secretRecoveryRequest.getDescription().challenge).toBe(params.challenge);
        expect(secretRecoveryRequest.getDescription().secretName).toBe(params.secretName);
        expect(secretRecoveryRequest.getDescription().requesterIdentityLocId).toBe(params.requesterIdentityLocId);
        expect(secretRecoveryRequest.getDescription().downloaded).toBe(false);
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
        const decision = request.getDecision();
        expect(decision?.decisionOn).toBeDefined();
        expect(decision?.rejectReason).toBe("Because.");
    })

    it("can download if accepted and not yet downloaded", () => testCanDownload({
        status: "ACCEPTED",
        decision: decision(moment()),
        downloaded: false,
        challenge: CHALLENGE,
        expected: true,
    }))
    it("cannot download if pending", () => testCanDownload({
        status: "PENDING",
        decision: new LegalOfficerDecision(),
        challenge: CHALLENGE,
        expected: false,
    }))
    it("cannot download if rejected", () => testCanDownload({
        status: "REJECTED",
        decision: decision(moment()),
        challenge: CHALLENGE,
        expected: false,
    }))
    it("cannot download if already downloaded", () => testCanDownload({
        status: "ACCEPTED",
        decision: decision(moment()),
        downloaded: true,
        challenge: CHALLENGE,
        expected: false,
    }))
    it("cannot download if expired", () => testCanDownload({
        status: "ACCEPTED",
        decision: decision(moment().subtract(SECRET_EXPIRATION_DAYS + 1, "days")),
        downloaded: false,
        challenge: CHALLENGE,
        expected: false,
    }))
    it("cannot download if wrong challenge", () => testCanDownload({
        status: "ACCEPTED",
        decision: decision(moment()),
        downloaded: false,
        challenge: CHALLENGE,
        givenChallenge: WRONG_CHALLENGE,
        expected: false,
    }))

    it("marks as downloaded", () => {
        const request = new SecretRecoveryRequestAggregateRoot();
        request.status = "ACCEPTED";
        request.downloaded = false;
        const now = moment();
        request.decision = decision(now.clone().subtract(SECRET_EXPIRATION_DAYS - 1, "days"));
        request.challenge = CHALLENGE;

        request.markDownloaded(now, CHALLENGE, true);

        expect(request.downloaded).toBe(true);
    })
})

function testCanDownload(args: { status: SecretRecoveryRequestStatus, decision: LegalOfficerDecision, expected: boolean, challenge: string, downloaded?: boolean, givenChallenge?: string }) {
    const { status, decision, expected, challenge, givenChallenge } = args;
    const request = new SecretRecoveryRequestAggregateRoot();
    request.status = status;
    request.decision = decision;
    request.downloaded = args.downloaded || false;
    request.challenge = challenge;
    expect(request.canDownload(moment(), givenChallenge || challenge)).toBe(expected);
}

const CHALLENGE = "challenge";
const WRONG_CHALLENGE = "wrong-challenge";

function decision(decisionOn: Moment) {
    const decision = new LegalOfficerDecision();
    decision.decisionOn = decisionOn.toISOString();
    return decision;
}
