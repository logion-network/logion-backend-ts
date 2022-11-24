import { TestApp } from "@logion/rest-api-core";
import { Container } from "inversify";
import { It, Mock } from "moq.ts";
import request from "supertest";
import { VerifiedThirdPartyController } from "../../../src/logion/controllers/verifiedthirdparty.controller";
import { buildMocks, buildMocksForFetch, buildMocksForUpdate, mockPolkadotIdentityLoc, mockRequestWithId, REQUEST_ID, setupRequest, userIdentities } from "./locrequest.controller.shared";
import { VerifiedThirdPartySelectionAggregateRoot, VerifiedThirdPartySelectionId, VerifiedThirdPartySelectionRepository } from "../../../src/logion/model/verifiedthirdpartyselection.model";
import { FetchLocRequestsSpecification, LocRequestAggregateRoot, LocRequestDescription, LocRequestRepository } from "../../../src/logion/model/locrequest.model";
import { ALICE } from "../../helpers/addresses";
import { NotificationService } from "../../../src/logion/services/notification.service";
import { UserIdentity } from "src/logion/model/useridentity";

const { setupApp, mockAuthenticationForUserOrLegalOfficer } = TestApp;

describe("VerifiedThirdPartyController", () => {

    it('nominates party', async () => testNominateDismiss(true));
    it('dismisses party', async () => testNominateDismiss(false));

    it('selects VTP', async () => {
        const repository = new Mock<VerifiedThirdPartySelectionRepository>();
        const nomination = new Mock<VerifiedThirdPartySelectionAggregateRoot>();
        nomination.setup(instance => instance.id).returns(SELECTION_ID);
        const notificationService = new Mock<NotificationService>();
        const app = setupApp(VerifiedThirdPartyController, container => mockModelForSelect(container, repository, nomination, notificationService))

        await request(app)
            .post(`/api/loc-request/${ REQUEST_ID }/selected-parties`)
            .send({ identityLocId: SELECTION_ID.verifiedThirdPartyLocId })
            .expect(204);

        repository.verify(instance => instance.save(nomination.object()));
        notificationService.verify(instance => instance.notify(VTP_EMAIL, "vtp-selected", It.Is<any>(data => "legalOfficer" in data && "loc" in data)));
    });

    it('re-selects VTP', async () => {
        const notificationService = new Mock<NotificationService>();
        const repository = new Mock<VerifiedThirdPartySelectionRepository>();
        const nomination = new Mock<VerifiedThirdPartySelectionAggregateRoot>();
        const app = setupApp(VerifiedThirdPartyController, container => mockModelForUnselectSelectAgain(container, repository, nomination, notificationService, true))

        await request(app)
            .post(`/api/loc-request/${ REQUEST_ID }/selected-parties`)
            .send({ identityLocId: SELECTION_ID.verifiedThirdPartyLocId })
            .expect(204);

        nomination.verify(instance => instance.setSelected(true));
        repository.verify(instance => instance.save(nomination.object()));
        notificationService.verify(instance => instance.notify(VTP_EMAIL, "vtp-selected", It.Is<any>(data => "legalOfficer" in data && "loc" in data)));
    });

    it('unselects VTP', async () => {
        const notificationService = new Mock<NotificationService>();
        const repository = new Mock<VerifiedThirdPartySelectionRepository>();
        const nomination = new Mock<VerifiedThirdPartySelectionAggregateRoot>();
        const app = setupApp(VerifiedThirdPartyController, container => mockModelForUnselectSelectAgain(container, repository, nomination, notificationService, false))

        await request(app)
            .delete(`/api/loc-request/${ REQUEST_ID }/selected-parties/${ SELECTION_ID.verifiedThirdPartyLocId }`)
            .expect(204);

        nomination.verify(instance => instance.setSelected(false));
        repository.verify(instance => instance.save(nomination.object()));
        notificationService.verify(instance => instance.notify(VTP_EMAIL, "vtp-unselected", It.Is<any>(data => "legalOfficer" in data && "loc" in data)));
    });

    it('lists Legal Officer VTPs', async () => {
        const app = setupApp(VerifiedThirdPartyController, mockModelForGetVerifiedThirdParties)

        await request(app)
            .get(`/api/verified-third-parties`)
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.verifiedThirdParties).toBeDefined();
                expect(response.body.verifiedThirdParties.length).toBe(2);
            });
    });

    it("lists the LOCs a VTP has been selected for", async () => {
        const authenticatedUserMock = mockAuthenticationForUserOrLegalOfficer(false, VTP_ADDRESS);
        const app = setupApp(VerifiedThirdPartyController, mockModelForGetVerifiedThirdPartyLocRequests, authenticatedUserMock);

        await request(app)
            .get(`/api/verified-third-party-loc-requests`)
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.requests).toBeDefined();
                expect(response.body.requests.length).toBe(1);
            });
    });
});

async function testNominateDismiss(nominate: boolean) {
    const notificationService = new Mock<NotificationService>();
    const verifiedThirdPartySelectionRepository = new Mock<VerifiedThirdPartySelectionRepository>();
    const locRequestRepository = new Mock<LocRequestRepository>();
    const locRequest = new Mock<LocRequestAggregateRoot>();
    verifiedThirdPartySelectionRepository.setup(instance => instance.unselectAll(REQUEST_ID)).returnsAsync();
    const app = setupApp(VerifiedThirdPartyController, container => mockModelForNominateDismiss(container, notificationService, nominate, verifiedThirdPartySelectionRepository, locRequestRepository, locRequest))
    await request(app)
        .put(`/api/loc-request/${ REQUEST_ID }/verified-third-party`)
        .send({ isVerifiedThirdParty: nominate })
        .expect(204);
    locRequestRepository.verify(instance => instance.save(locRequest.object()));
    if(!nominate) {
        verifiedThirdPartySelectionRepository.verify(instance => instance.unselectAll(REQUEST_ID));
    }
    notificationService.verify(instance => instance.notify(VTP_EMAIL, nominate ? "vtp-nominated" : "vtp-dismissed", It.Is<any>(data => "legalOfficer" in data)));
}

function mockModelForNominateDismiss(container: Container, notificationService: Mock<NotificationService>, nominate: boolean, verifiedThirdPartyNominationRepository: Mock<VerifiedThirdPartySelectionRepository>, locRequestRepository: Mock<LocRequestRepository>, locRequest: Mock<LocRequestAggregateRoot>) {
    buildMocksForUpdate(container, { notificationService, verifiedThirdPartySelectionRepository: verifiedThirdPartyNominationRepository, repository: locRequestRepository, request: locRequest });
    setupRequest(locRequest, REQUEST_ID, "Identity", "CLOSED", { userIdentity: { email: VTP_EMAIL } as UserIdentity });
    locRequest.setup(instance => instance.setVerifiedThirdParty(nominate)).returns(undefined);
}

const VTP_EMAIL = userIdentities["Polkadot"].userIdentity?.email;
const VTP_ADDRESS = "5FniDvPw22DMW1TLee9N8zBjzwKXaKB2DcvZZCQU5tjmv1kb";

const SELECTION_ID: VerifiedThirdPartySelectionId = {
    locRequestId: REQUEST_ID,
    verifiedThirdPartyLocId: userIdentities["Polkadot"].identityLocId!
};

const NOMINATION_ID_IS = It.Is<VerifiedThirdPartySelectionId>(id =>
    id.locRequestId === SELECTION_ID.locRequestId
    && id.verifiedThirdPartyLocId === SELECTION_ID.verifiedThirdPartyLocId
);

function mockModelForSelect(
    container: Container,
    verifiedThirdPartyNominationRepository: Mock<VerifiedThirdPartySelectionRepository>,
    nomination: Mock<VerifiedThirdPartySelectionAggregateRoot>,
    notificationService: Mock<NotificationService>,
) {
    const { request, repository, verifiedThirdPartySelectionFactory: verifiedThirdPartyNominationFactory } = buildMocksForFetch(container, { verifiedThirdPartySelectionRepository: verifiedThirdPartyNominationRepository, notificationService });
    mockPolkadotIdentityLoc(repository, true);

    const description = new Mock<LocRequestDescription>();
    request.setup(instance => instance.id).returns(REQUEST_ID);
    request.setup(instance => instance.getDescription()).returns(description.object());

    verifiedThirdPartyNominationFactory.setup(instance => instance.newNomination(
        It.Is<{
            locRequest: LocRequestAggregateRoot,
            verifiedThirdPartyLocRequest: LocRequestAggregateRoot,
        }>(id =>
            id.verifiedThirdPartyLocRequest.id === SELECTION_ID.verifiedThirdPartyLocId
            && id.locRequest === request.object())))
    .returns(nomination.object());

    verifiedThirdPartyNominationRepository.setup(instance => instance.findById(NOMINATION_ID_IS)).returnsAsync(null);
    verifiedThirdPartyNominationRepository.setup(instance => instance.save(nomination.object())).returnsAsync();
}

function mockModelForUnselectSelectAgain(
    container: Container,
    verifiedThirdPartyNominationRepository: Mock<VerifiedThirdPartySelectionRepository>,
    nomination: Mock<VerifiedThirdPartySelectionAggregateRoot>,
    notificationService: Mock<NotificationService>,
    selected: boolean,
) {
    const { request, repository } = buildMocksForFetch(container, { verifiedThirdPartySelectionRepository: verifiedThirdPartyNominationRepository, notificationService });
    mockPolkadotIdentityLoc(repository, true);

    const description = new Mock<LocRequestDescription>();
    request.setup(instance => instance.id).returns(REQUEST_ID);
    request.setup(instance => instance.getDescription()).returns(description.object());

    nomination.setup(instance => instance.setSelected(selected)).returns();

    verifiedThirdPartyNominationRepository.setup(instance => instance.findById(NOMINATION_ID_IS)).returnsAsync(nomination.object());
    verifiedThirdPartyNominationRepository.setup(instance => instance.save(nomination.object())).returnsAsync();
}

function mockModelForGetVerifiedThirdParties(container: Container) {
    const { repository } = buildMocks(container);

    const identityLoc1 = mockRequestWithId(
        userIdentities["Polkadot"].identityLocId!,
        "Identity",
        "CLOSED",
        {
            userIdentity: userIdentities["Polkadot"].userIdentity,
            userPostalAddress: userIdentities["Polkadot"].userPostalAddress,
            verifiedThirdParty: true,
        }
    );
    const identityLoc2 = mockRequestWithId(
        userIdentities["Logion"].identityLocId!,
        "Identity",
        "CLOSED",
        {
            userIdentity: userIdentities["Logion"].userIdentity,
            userPostalAddress: userIdentities["Logion"].userPostalAddress,
            verifiedThirdParty: true,
        }
    );

    repository.setup(instance => instance.findBy(It.Is<FetchLocRequestsSpecification>(spec =>
        spec.expectedOwnerAddress === ALICE
        && spec.isVerifiedThirdParty === true
    ))).returnsAsync([ identityLoc1.object(), identityLoc2.object() ]);
}

function mockModelForGetVerifiedThirdPartyLocRequests(container: Container) {
    const { repository, verifiedThirdPartySelectionRepository } = buildMocks(container);

    const verifiedThirdPartyLocId = SELECTION_ID.verifiedThirdPartyLocId;
    const vtpIdentityLocRequest = new Mock<LocRequestAggregateRoot>();
    vtpIdentityLocRequest.setup(instance => instance.id).returns(verifiedThirdPartyLocId);
    vtpIdentityLocRequest.setup(instance => instance.getVoidInfo()).returns(null);
    repository.setup(instance => instance.findBy(It.Is<FetchLocRequestsSpecification>(spec =>
        spec.expectedRequesterAddress === VTP_ADDRESS
        && spec.expectedLocTypes !== undefined && spec.expectedLocTypes.length === 1 && spec.expectedLocTypes[0] === "Identity"
        && spec.expectedStatuses !== undefined && spec.expectedStatuses.length === 1 && spec.expectedStatuses[0] === "CLOSED"
        && spec.isVerifiedThirdParty === true
    ))).returnsAsync([ vtpIdentityLocRequest.object() ]);

    const locRequestId = "1de855e6-4da8-4b18-b498-e928447da908";
    const selection = new Mock<VerifiedThirdPartySelectionAggregateRoot>();
    selection.setup(instance => instance.id).returns({
        locRequestId,
        verifiedThirdPartyLocId,
    });
    verifiedThirdPartySelectionRepository.setup(instance => instance.findBy(It.Is<Partial<VerifiedThirdPartySelectionId>>(id =>
        id.verifiedThirdPartyLocId === SELECTION_ID.verifiedThirdPartyLocId
        && id.locRequestId === undefined
    ))).returnsAsync([ selection.object() ]);

    const locWithSelection = new Mock<LocRequestAggregateRoot>();
    setupRequest(locWithSelection, locRequestId, "Transaction", "OPEN");
    repository.setup(instance => instance.findById(locRequestId)).returnsAsync(locWithSelection.object());
}
