import { Mock, It } from "moq.ts";
import { UUID, Sponsorship, LogionNodeApiClass } from "@logion/node-api";
import { LocRequestRepository, FetchLocRequestsSpecification } from "../../../src/logion/model/locrequest.model.js";
import { SponsorshipService } from "../../../src/logion/services/sponsorship.service.js";
import { PolkadotService } from "@logion/rest-api-core";
import { ALICE_ACCOUNT, CHARLY_ACCOUNT, BOB_ACCOUNT } from "../../helpers/addresses.js";
import { POLKADOT_REQUESTER } from "../controllers/locrequest.controller.shared.js";
import { polkadotAccount, SupportedAccountId } from "../../../src/logion/model/supportedaccountid.model.js";
import { expectAsyncToThrow } from "../../helpers/asynchelper.js";

const locRequestRepository: Mock<LocRequestRepository> = new Mock<LocRequestRepository>();
const logionApi: Mock<LogionNodeApiClass> = new Mock<LogionNodeApiClass>();

const sponsorshipNotFound = new UUID();
const sponsorshipAlreadyRequested = new UUID();
const sponsorshipAlreadyOpenSameLLO = new UUID();
const sponsorshipAlreadyOpenDifferentLLO = new UUID();
const validSponsorship = new UUID();

const openLocId = new UUID();

describe("SponsorshipService", () => {

    const service = createService();

    async function testError(sponsorshipId: UUID, expectedError: string, legalOfficer?: SupportedAccountId, requester?: SupportedAccountId) {
        return expectAsyncToThrow(
            () => service.validateSponsorship(sponsorshipId, legalOfficer ? legalOfficer : ALICE_ACCOUNT, requester ? requester : POLKADOT_REQUESTER),
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
        await testError(validSponsorship, "This sponsorship is not applicable to your request", wrongLegalOfficer, POLKADOT_REQUESTER)
    })

    it("throws error for wrong Sponsored Account", async () => {
        const wrongRequester = polkadotAccount("5GnPfHk6Y6qsqSYQ5V6rRSaWxHf86QW1b2DQDGft1FjDT2iN");
        await testError(validSponsorship, "This sponsorship is not applicable to your request", ALICE_ACCOUNT, wrongRequester)
    })

    it("validates a valid sponsorship", async () => {
        await service.validateSponsorship(validSponsorship, ALICE_ACCOUNT, POLKADOT_REQUESTER);
    })
})

function mockRepository(sponsorshipId: UUID, exists: boolean) {
    locRequestRepository.setup(instance => instance.existsBy(
        It.Is<FetchLocRequestsSpecification>(spec => spec.expectedSponsorshipId?.toString() === sponsorshipId.toString())))
        .returnsAsync(exists)
}

function mockLogionApi(sponsorshipId: UUID, sponsorship: Sponsorship | undefined) {
    logionApi.setup(instance => instance.queries.getSponsorship(sponsorshipId))
        .returnsAsync(sponsorship);
}

function mockSponsorship(locId: UUID | undefined): Sponsorship {
    return {
        locId,
        sponsor: BOB_ACCOUNT,
        legalOfficer: ALICE_ACCOUNT,
        sponsoredAccount: POLKADOT_REQUESTER
    }
}

function createService(): SponsorshipService {

    mockRepository(sponsorshipNotFound, false);
    mockRepository(sponsorshipAlreadyRequested, true);
    mockRepository(sponsorshipAlreadyOpenSameLLO, true);
    mockRepository(sponsorshipAlreadyOpenDifferentLLO, false);
    mockRepository(validSponsorship, false);

    mockLogionApi(sponsorshipNotFound, undefined);
    mockLogionApi(sponsorshipAlreadyRequested, mockSponsorship(undefined));
    mockLogionApi(sponsorshipAlreadyOpenSameLLO, mockSponsorship(openLocId));
    mockLogionApi(sponsorshipAlreadyOpenDifferentLLO, mockSponsorship(openLocId));
    mockLogionApi(validSponsorship, mockSponsorship(undefined));

    const polkadotService = {
        readyApi: () => Promise.resolve(logionApi.object())
    }
    return new SponsorshipService(
        polkadotService as PolkadotService,
        locRequestRepository.object()
    );
}

