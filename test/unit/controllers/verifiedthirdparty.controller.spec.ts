import { TestApp } from "@logion/rest-api-core";
import { Container } from "inversify";
import { It, Mock } from "moq.ts";
import request from "supertest";
import { VerifiedThirdPartyController } from "../../../src/logion/controllers/verifiedthirdparty.controller";
import { buildMocks, buildMocksForFetch, buildMocksForUpdate, mockPolkadotIdentityLoc, mockRequestWithId, REQUEST_ID, setupRequest, userIdentities } from "./locrequest.controller.shared";
import { VerifiedThirdPartySelectionAggregateRoot, VerifiedThirdPartySelectionId, VerifiedThirdPartySelectionRepository } from "../../../src/logion/model/verifiedthirdpartyselection.model";
import { FetchLocRequestsSpecification, LocRequestAggregateRoot, LocRequestDescription } from "../../../src/logion/model/locrequest.model";
import { ALICE } from "../../helpers/addresses";
import { NotificationService } from "../../../src/logion/services/notification.service";
import { UserIdentity } from "src/logion/model/useridentity";

const { setupApp } = TestApp;

describe("VerifiedThirdPartyController", () => {

    it('nominates party', async () => testNominateDismiss(true));
    it('dismisses party', async () => testNominateDismiss(false));

    it('selects VTP', async () => {
        const repository = new Mock<VerifiedThirdPartySelectionRepository>();
        const nomination = new Mock<VerifiedThirdPartySelectionAggregateRoot>();
        nomination.setup(instance => instance.id).returns(NOMINATION_ID);
        const notificationService = new Mock<NotificationService>();
        const app = setupApp(VerifiedThirdPartyController, container => mockModelForSelect(container, repository, nomination, notificationService))

        await request(app)
            .post(`/api/loc-request/${ REQUEST_ID }/selected-parties`)
            .send({ identityLocId: NOMINATION_ID.verifiedThirdPartyLocId })
            .expect(204);

        repository.verify(instance => instance.save(nomination.object()));
        notificationService.verify(instance => instance.notify(VTP_EMAIL, "vtp-selected", It.Is<any>(data => "legalOfficer" in data && "loc" in data)));
    });

    it('unselects VTP', async () => {
        const notificationService = new Mock<NotificationService>();
        const repository = new Mock<VerifiedThirdPartySelectionRepository>();
        const app = setupApp(VerifiedThirdPartyController, container => mockModelForUnselect(container, repository, notificationService))

        await request(app)
            .delete(`/api/loc-request/${ REQUEST_ID }/selected-parties/${ NOMINATION_ID.verifiedThirdPartyLocId }`)
            .expect(204);

        repository.verify(instance => instance.deleteById(NOMINATION_ID_IS));
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
});

async function testNominateDismiss(nominate: boolean) {
    const notificationService = new Mock<NotificationService>();
    const verifiedThirdPartyNominationRepository = new Mock<VerifiedThirdPartySelectionRepository>();
    verifiedThirdPartyNominationRepository.setup(instance => instance.deleteByVerifiedThirdPartyId(REQUEST_ID)).returnsAsync();
    const app = setupApp(VerifiedThirdPartyController, container => mockModelForNominateDismiss(container, notificationService, nominate, verifiedThirdPartyNominationRepository))
    await request(app)
        .put(`/api/loc-request/${ REQUEST_ID }/verified-third-party`)
        .send({ isVerifiedThirdParty: nominate })
        .expect(204);
    if(!nominate) {
        verifiedThirdPartyNominationRepository.verify(instance => instance.deleteByVerifiedThirdPartyId(REQUEST_ID));
    }
    notificationService.verify(instance => instance.notify(VTP_EMAIL, nominate ? "vtp-nominated" : "vtp-dismissed", It.Is<any>(data => "legalOfficer" in data)));
}

function mockModelForNominateDismiss(container: Container, notificationService: Mock<NotificationService>, nominate: boolean, verifiedThirdPartyNominationRepository: Mock<VerifiedThirdPartySelectionRepository>) {
    const { request } = buildMocksForUpdate(container, { notificationService, verifiedThirdPartyNominationRepository });
    setupRequest(request, REQUEST_ID, "Identity", "CLOSED", { userIdentity: { email: VTP_EMAIL } as UserIdentity });
    request.setup(instance => instance.setVerifiedThirdParty(nominate)).returns(undefined);
}

const VTP_EMAIL = userIdentities["Polkadot"].userIdentity?.email;

const NOMINATION_ID: VerifiedThirdPartySelectionId = {
    locRequestId: REQUEST_ID,
    verifiedThirdPartyLocId: userIdentities["Polkadot"].identityLocId!
};

const NOMINATION_ID_IS = It.Is<VerifiedThirdPartySelectionId>(id =>
    id.locRequestId === NOMINATION_ID.locRequestId
    && id.verifiedThirdPartyLocId === NOMINATION_ID.verifiedThirdPartyLocId
);

function mockModelForSelect(
    container: Container,
    verifiedThirdPartyNominationRepository: Mock<VerifiedThirdPartySelectionRepository>,
    nomination: Mock<VerifiedThirdPartySelectionAggregateRoot>,
    notificationService: Mock<NotificationService>,
) {
    const { request, repository, verifiedThirdPartyNominationFactory } = buildMocksForFetch(container, { verifiedThirdPartyNominationRepository, notificationService });
    mockPolkadotIdentityLoc(repository, true);

    const description = new Mock<LocRequestDescription>();
    request.setup(instance => instance.getDescription()).returns(description.object());

    verifiedThirdPartyNominationFactory.setup(instance => instance.newNomination(
        It.Is<{
            locRequest: LocRequestAggregateRoot,
            verifiedThirdPartyLocRequest: LocRequestAggregateRoot,
        }>(id =>
            id.verifiedThirdPartyLocRequest.id === NOMINATION_ID.verifiedThirdPartyLocId
            && id.locRequest === request.object())))
    .returnsAsync(nomination.object());

    verifiedThirdPartyNominationRepository.setup(instance => instance.save(nomination.object())).returnsAsync();
}

function mockModelForUnselect(
    container: Container,
    verifiedThirdPartyNominationRepository: Mock<VerifiedThirdPartySelectionRepository>,
    notificationService: Mock<NotificationService>,
) {
    const { request, repository } = buildMocksForFetch(container, { verifiedThirdPartyNominationRepository, notificationService });
    mockPolkadotIdentityLoc(repository, true);

    const description = new Mock<LocRequestDescription>();
    request.setup(instance => instance.getDescription()).returns(description.object());

    verifiedThirdPartyNominationRepository.setup(instance => instance.deleteById(NOMINATION_ID_IS)).returnsAsync();
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
