import { TestApp } from "@logion/rest-api-core";
import { LocRequestController } from "../../../src/logion/controllers/locrequest.controller.js";
import { Container } from "inversify";
import request from "supertest";
import { Mock, It, Times } from "moq.ts";
import {
    LocType,
} from "../../../src/logion/model/locrequest.model.js";
import { Moment } from "moment";
import { NotificationService } from "../../../src/logion/services/notification.service.js";
import { UserIdentity } from "../../../src/logion/model/useridentity.js";
import { buildMocksForUpdate, mockPolkadotIdentityLoc, Mocks, REQUEST_ID, setupRequest, testData, testDataWithType, userIdentities } from "./locrequest.controller.shared.js";
import { BOB } from "../../helpers/addresses.js";

const { setupApp, mockLegalOfficerOnNode, mockAuthenticationWithAuthenticatedUser } = TestApp;

describe('LocRequestController - Life Cycle - Authenticated LLO is **NOT** LOC owner', () => {

    function authenticatedLLONotLocOwner() {
        const authenticatedUser = mockLegalOfficerOnNode(BOB); // Alice is LOC owner
        return mockAuthenticationWithAuthenticatedUser(authenticatedUser);
    }

    it('fails to reject a requested loc', async () => {
        const notificationService = new Mock<NotificationService>();
        const app = setupApp(LocRequestController, container => mockModelForReject(container, notificationService), authenticatedLLONotLocOwner());
        await request(app)
            .post(`/api/loc-request/${ REQUEST_ID }/reject`)
            .send({
                rejectReason: REJECT_REASON
            })
            .expect(401)
        notificationService.verify(instance => instance.notify, Times.Never());
    })

    it('fails to accepts a requested loc', async () => {

        const notificationService = new Mock<NotificationService>();
        const app = setupApp(LocRequestController, container => mockModelForAccept(container, notificationService), authenticatedLLONotLocOwner());
        await request(app)
            .post(`/api/loc-request/${ REQUEST_ID }/accept`)
            .expect(401)
        notificationService.verify(instance => instance.notify, Times.Never());
    })

    it('fails to pre-close a Transaction LOC', async () => {
        const app = setupApp(LocRequestController, container => mockModelForPreClose(container, "Transaction"), authenticatedLLONotLocOwner())
        await request(app)
            .post(`/api/loc-request/${REQUEST_ID}/close`)
            .expect(401);
    });

    it('fails to  to pre-close an Identity LOC', async () => {
        const app = setupApp(LocRequestController, container => mockModelForPreClose(container, "Identity", testUserIdentity), authenticatedLLONotLocOwner())
        await request(app)
            .post(`/api/loc-request/${REQUEST_ID}/close`)
            .expect(401);
    });

    it('fails to pre-void', async () => {
        const app = setupApp(LocRequestController, mockModelForPreVoid, authenticatedLLONotLocOwner())
        await request(app)
            .post(`/api/loc-request/${REQUEST_ID}/void`)
            .send({
                reason: VOID_REASON
            })
            .expect(401);
    });

})

describe('LocRequestController - Life Cycle - Authenticated LLO is LOC owner', () => {

    it('rejects a requested loc', async () => {
        const notificationService = new Mock<NotificationService>();
        const app = setupApp(LocRequestController, container => mockModelForReject(container, notificationService))
        await request(app)
            .post(`/api/loc-request/${ REQUEST_ID }/reject`)
            .send({
                rejectReason: REJECT_REASON
            })
            .expect(200)

        notificationService.verify(instance => instance.notify(testUserIdentity.email, "loc-rejected", It.Is<any>(data => {
            return data.loc.decision.rejectReason === REJECT_REASON &&
                data.loc.decision.decisionOn === DECISION_TIMESTAMP
        })))
    })

    it('accepts a requested loc', async () => {
        const notificationService = new Mock<NotificationService>();
        const app = setupApp(LocRequestController, container => mockModelForAccept(container, notificationService))
        await request(app)
            .post(`/api/loc-request/${ REQUEST_ID }/accept`)
            .expect(200)

        notificationService.verify(instance => instance.notify(testUserIdentity.email, "loc-accepted", It.Is<any>(data => {
            return data.loc.decision.decisionOn === DECISION_TIMESTAMP
        })))
    })

    it('pre-closes a Transaction LOC', async () => {
        const app = setupApp(LocRequestController, container => mockModelForPreClose(container, "Transaction"))
        await request(app)
            .post(`/api/loc-request/${REQUEST_ID}/close`)
            .expect(204);
    });

    it('pre-closes an Identity LOC', async () => {
        const app = setupApp(LocRequestController, container => mockModelForPreClose(container, "Identity", testUserIdentity))
        await request(app)
            .post(`/api/loc-request/${REQUEST_ID}/close`)
            .expect(204);
    });

    it('pre-voids', async () => {
        const app = setupApp(LocRequestController, mockModelForPreVoid)
        await request(app)
            .post(`/api/loc-request/${REQUEST_ID}/void`)
            .send({
                reason: VOID_REASON
            })
            .expect(204);
    });

    it('submits a draft loc', async () => {
        const app = setupApp(LocRequestController, mockModelForSubmit)
        await request(app)
            .post(`/api/loc-request/${ REQUEST_ID }/submit`)
            .expect(200);
    })

    it('cancels a draft or rejected loc', async () => {
        const app = setupApp(LocRequestController, mockModelForCancel)
        await request(app)
            .post(`/api/loc-request/${ REQUEST_ID }/cancel`)
            .expect(200);
    })

    it('reworks a rejected loc', async () => {
        const app = setupApp(LocRequestController, mockModelForRework)
        await request(app)
            .post(`/api/loc-request/${ REQUEST_ID }/rework`)
            .expect(200);
    })
});

function mockModelForReject(container: Container, notificationService: Mock<NotificationService>): void {
    const { request } = buildMocksForDecision(container, notificationService, REJECT_REASON);
    request.setup(instance => instance.reject(It.Is<string>(reason => reason === REJECT_REASON), It.IsAny<Moment>()))
        .returns();
}

function buildMocksForDecision(container: Container, notificationService: Mock<NotificationService>, rejectReason?: string): Mocks {
    const mocks = buildMocksForUpdate(container, { notificationService });

    setupRequest(mocks.request, REQUEST_ID, "Transaction", "REQUESTED", testData);
    mocks.request.setup(instance => instance.getDecision())
        .returns({ decisionOn: DECISION_TIMESTAMP, rejectReason });

    mockPolkadotIdentityLoc(mocks.repository, true);

    return mocks;
}

const REJECT_REASON = "Illegal";
const testUserIdentity = userIdentities["Polkadot"].userIdentity!;
const DECISION_TIMESTAMP = "2022-08-31T16:01:15.652Z"

function mockModelForAccept(container: Container, notificationService: Mock<NotificationService>): void {
    const { request } = buildMocksForDecision(container, notificationService);
    request.setup(instance => instance.accept(It.Is<string>(It.IsAny<Moment>())))
        .returns();
}

function mockModelForPreClose(container: Container, locType: LocType, userIdentity?: UserIdentity) {
    const { request, repository } = buildMocksForUpdate(container);

    const data = {
        ...testDataWithType(locType),
        userIdentity
    };
    setupRequest(request, REQUEST_ID, locType, "OPEN", data);
    request.setup(instance => instance.preClose()).returns();

    mockPolkadotIdentityLoc(repository, false);
}

function mockModelForPreVoid(container: Container) {
    const { request } = buildMocksForUpdate(container);
    setupRequest(request, REQUEST_ID, "Identity", "OPEN", testData);
    request.setup(instance => instance.preVoid(VOID_REASON)).returns();
}

const VOID_REASON = "Expired";

function mockModelForSubmit(container: Container) {
    const { request, repository } = buildMocksForUpdate(container);
    setupRequest(request, REQUEST_ID, "Identity", "DRAFT", testData);
    mockPolkadotIdentityLoc(repository, true);
    request.setup(instance => instance.submit()).returns();
}

function mockModelForCancel(container: Container) {
    const { request, repository, fileStorageService } = buildMocksForUpdate(container);
    setupRequest(request, REQUEST_ID, "Identity", "DRAFT", testData);

    const dbFile = { oid: 1 };
    const ipfsFile = { cid: "" };
    request.setup(instance => instance.files).returns([ dbFile, ipfsFile ])

    repository.setup(instance => instance.deleteDraftOrRejected(request.object()))
        .returns(Promise.resolve());

    fileStorageService.setup(instance => instance.deleteFile(dbFile)).returnsAsync();
    fileStorageService.setup(instance => instance.deleteFile(ipfsFile)).returnsAsync();
}

function mockModelForRework(container: Container) {
    const { request } = buildMocksForUpdate(container);
    setupRequest(request, REQUEST_ID, "Identity", "REJECTED");
    request.setup(instance => instance.rework()).returns(undefined);
}
