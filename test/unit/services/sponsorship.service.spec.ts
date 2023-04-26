import { Mock, It } from "moq.ts";
import { Queries, UUID, Sponsorship } from "@logion/node-api";
import { LocRequestRepository, FetchLocRequestsSpecification } from "../../../src/logion/model/locrequest.model.js";
import { SponsorshipService } from "../../../src/logion/services/sponsorship.service.js";
import { PolkadotService } from "@logion/rest-api-core";
import { ALICE_ACCOUNT, CHARLY_ACCOUNT, BOB_ACCOUNT } from "../../helpers/addresses.js";
import { REQUESTER_ADDRESS } from "../controllers/locrequest.controller.shared.js";
import { polkadotAccount, SupportedAccountId } from "../../../src/logion/model/supportedaccountid.model.js";

const locRequestRepository: Mock<LocRequestRepository> = new Mock<LocRequestRepository>();
const queries: Mock<Queries> = new Mock<Queries>();

const sponsorshipNotFound = new UUID();
const sponsorshipAlreadyRequested = new UUID();
const sponsorshipAlreadyOpenSameLLO = new UUID();
const sponsorshipAlreadyOpenDifferentLLO = new UUID();
const validSponsorship = new UUID();

const openLocId = new UUID();

describe("SponsorshipService", () => {

    const service = createService();

    async function testError(sponsorshipId: UUID, expectedError: string, legalOfficer?: SupportedAccountId, requester?: SupportedAccountId) {
        expectAsyncToThrow(
            () => service.validateSponsorship(sponsorshipId, legalOfficer ? legalOfficer : ALICE_ACCOUNT, requester ? requester : REQUESTER_ADDRESS),
            expectedError
        )
    }

    it("throws error if sponsorship not found", async () =>
        await testError(sponsorshipNotFound, "Sponsorship not found")
    )

    it("throws error if sponsorship already used in a request", async () =>
        await testError(sponsorshipAlreadyRequested, "This sponsorship is already used in a draft/requested LOC")
    )

    it("throws error if sponsorship already used in a LOC with the same LLO", async () =>
        await testError(sponsorshipAlreadyOpenSameLLO, "This sponsorship is already used in an open/closed/voided LOC")
    )

    it("throws error if sponsorship already used in a LOC with a different LLO", async () =>
        await testError(sponsorshipAlreadyOpenDifferentLLO, "This sponsorship is already used in an open/closed/voided LOC")
    )

    it("throws error for wrong Legal Officer", async () => {
        const wrongLegalOfficer = CHARLY_ACCOUNT;
        await testError(validSponsorship, "This sponsorship is not applicable to your request", wrongLegalOfficer, REQUESTER_ADDRESS)
    })

    it("throws error for wrong Sponsored Account", async () => {
        const wrongRequester = polkadotAccount("5GnPfHk6Y6qsqSYQ5V6rRSaWxHf86QW1b2DQDGft1FjDT2iN");
        await testError(validSponsorship, "This sponsorship is not applicable to your request", ALICE_ACCOUNT, wrongRequester)
    })

    it("validates a valid sponsorship", async () => {
        await service.validateSponsorship(validSponsorship, ALICE_ACCOUNT, REQUESTER_ADDRESS);
    })
})

function mockRepository(sponsorshipId: UUID, exists: boolean) {
    locRequestRepository.setup(instance => instance.existsBy(
        It.Is<FetchLocRequestsSpecification>(spec => spec.expectedSponsorshipId?.toString() === sponsorshipId.toString())))
        .returnsAsync(exists)
}

function mockQueries(sponsorshipId: UUID, sponsorship: Sponsorship | undefined) {
    queries.setup(instance => instance.getSponsorship(sponsorshipId))
        .returnsAsync(sponsorship);
}

function mockSponsorship(locId: UUID | undefined): Sponsorship {
    return {
        locId,
        sponsor: BOB_ACCOUNT,
        legalOfficer: ALICE_ACCOUNT,
        sponsoredAccount: REQUESTER_ADDRESS
    }
}

function createService(): SponsorshipService {

    mockRepository(sponsorshipNotFound, false);
    mockRepository(sponsorshipAlreadyRequested, true);
    mockRepository(sponsorshipAlreadyOpenSameLLO, true);
    mockRepository(sponsorshipAlreadyOpenDifferentLLO, false);
    mockRepository(validSponsorship, false);

    mockQueries(sponsorshipNotFound, undefined);
    mockQueries(sponsorshipAlreadyRequested, mockSponsorship(undefined));
    mockQueries(sponsorshipAlreadyOpenSameLLO, mockSponsorship(openLocId));
    mockQueries(sponsorshipAlreadyOpenDifferentLLO, mockSponsorship(openLocId));
    mockQueries(validSponsorship, mockSponsorship(undefined));

    const polkadotService = {
        queries: () => Promise.resolve(queries.object())
    }
    return new SponsorshipService(
        polkadotService as PolkadotService,
        locRequestRepository.object()
    );
}

function expectAsyncToThrow(func: () => Promise<void>, expectedError: string) {
    const promise = func();
    promise
        .then(_ => fail("Call succeeded while an error was expected to throw"))
        .catch(error => expect(error.toString()).toEqual(`Error: ${ expectedError }`));
}

