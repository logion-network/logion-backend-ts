import { TestApp } from "@logion/rest-api-core";
import { LocRequestController } from "../../../src/logion/controllers/locrequest.controller.js";
import { Container } from "inversify";
import request from "supertest";
import { ALICE, BOB, ALICE_ACCOUNT } from "../../helpers/addresses.js";
import {
    FileDescription,
    LinkDescription,
    MetadataItemDescription,
    LocType, LocRequestDescription,
} from "../../../src/logion/model/locrequest.model.js";
import moment from "moment";
import {
    buildMocksForFetch,
    checkPrivateData,
    IdentityLocation,
    mockLogionIdentityLoc,
    mockPolkadotIdentityLoc,
    REQUEST_ID,
    setupRequest,
    setupSelectedIssuer,
    SetupIssuerMode,
    testData,
    testDataWithLogionIdentity,
    testDataWithType,
    testDataWithUserIdentity,
    testDataWithUserIdentityWithType,
    userIdentities,
    ISSUER,
    setUpVote, VOTE_ID, mockRequester, mockOwner
} from "./locrequest.controller.shared.js";
import { mockAuthenticationForUserOrLegalOfficer } from "@logion/rest-api-core/dist/TestApp.js";
import { UserPrivateData } from "src/logion/controllers/adapters/locrequestadapter.js";
import { Fees, Hash } from "@logion/node-api";
import { polkadotAccount } from "../../../src/logion/model/supportedaccountid.model.js";

const { mockAuthenticationWithCondition, setupApp } = TestApp;

describe('LocRequestController - Fetch -', () => {

    it('succeeds to fetch loc requests with embedded user identity', async () => {
        const app = setupApp(LocRequestController, mockModelForFetch)
        await request(app)
            .put('/api/loc-request')
            .send({
                requesterAddress: testDataWithUserIdentity.requesterAddress,
                statuses: [ "OPEN", "REJECTED" ]
            })
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                const expectedUserPrivateData = userIdentities["EmbeddedInLoc"];
                expect(response.body.requests.length).toBe(1);
                const request1 = response.body.requests[0];
                expect(request1.id).toBe(REQUEST_ID);
                expect(request1.requesterAddress.address).toEqual(testData.requesterAddress?.address);
                expect(request1.requesterAddress.type).toEqual(testData.requesterAddress?.type);
                expect(request1.ownerAddress).toBe(ALICE);
                expect(request1.status).toBe("REVIEW_REJECTED");
                expect(request1.rejectReason).toBe(REJECT_REASON);
                const userIdentity = request1.userIdentity;
                expect(userIdentity).toEqual(expectedUserPrivateData.userIdentity)
                const userPostalAddress = request1.userPostalAddress;
                expect(userPostalAddress).toEqual(expectedUserPrivateData.userPostalAddress)
            });
    });

    it('fails to fetch loc requests - authentication failure', async () => {
        const app = setupApp(
            LocRequestController,
            mockModelForFetch,
            mockAuthenticationWithCondition(false),
        );
        await request(app)
            .put('/api/loc-request')
            .send({
                requesterAddress: testData.requesterAddress,
                statuses: [ "OPEN", "REJECTED" ]
            })
            .expect(401)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.requests).toBeUndefined();
            });
    });

    it('succeeds to get single Transaction Loc request with embedded Identity', async () => {
        const app = setupApp(LocRequestController, container => mockModelForGetSingle(container, 'Transaction', 'EmbeddedInLoc'))
        await testGet(app, userIdentities["EmbeddedInLoc"])
    });

    it('succeeds to get single Transaction Loc request with Polkadot Identity', async () => {
        const app = setupApp(LocRequestController, container => mockModelForGetSingle(container, 'Transaction','Polkadot'))
        await testGet(app, userIdentities["Polkadot"])
    });

    it('succeeds to get single Transaction Loc request with Logion Identity', async () => {
        const app = setupApp(LocRequestController, container => mockModelForGetSingle(container, 'Transaction','Logion'))
        await testGet(app, userIdentities["Logion"])
    });

    it('succeeds to get single Collection Loc request with embedded Identity', async () => {
        const app = setupApp(LocRequestController, container => mockModelForGetSingle(container, 'Collection', 'EmbeddedInLoc'))
        await testGet(app, userIdentities["EmbeddedInLoc"])
    });

    it('succeeds to get single Collection Loc request with Polkadot Identity', async () => {
        const app = setupApp(LocRequestController, container => mockModelForGetSingle(container, 'Collection','Polkadot'))
        await testGet(app, userIdentities["Polkadot"])
    });

    it('succeeds to get single Collection Loc request with Logion Identity', async () => {
        const app = setupApp(LocRequestController, container => mockModelForGetSingle(container, 'Collection','Logion'))
        await testGet(app, userIdentities["Logion"])
    });

    it('succeeds to get single Identity Loc request', async () => {
        const app = setupApp(LocRequestController, container => mockModelForGetSingle(container, 'Identity','EmbeddedInLoc'))
        await testGet(app, userIdentities["EmbeddedInLoc"])
    });

    it('fails to get single LOC if not contributor', async () => {
        const mock = mockAuthenticationForUserOrLegalOfficer(false, "any other address");
        const app = setupApp(LocRequestController, container => mockModelForGetSingle(container, 'Identity','EmbeddedInLoc'), mock);
        await request(app)
            .get(`/api/loc-request/${ REQUEST_ID }`)
            .expect(403);
    });

    it('succeeds to get single LOC if verified issuer', async () => {
        const mock = mockAuthenticationForUserOrLegalOfficer(false, ISSUER.address);
        const app = setupApp(LocRequestController, container => mockModelForGetSingle(container, 'Identity','EmbeddedInLoc', 'SELECTED'), mock);
        await request(app)
            .get(`/api/loc-request/${ REQUEST_ID }`)
            .expect(200)
            .expect('Content-Type', /application\/json/);
    });

    it('succeeds to get single LOC when LLO with Vote', async () => {
        const mock = mockAuthenticationForUserOrLegalOfficer(true, BOB);
        const app = setupApp(LocRequestController, container => mockModelForGetSingle(container, 'Identity','EmbeddedInLoc', 'NOT_ISSUER', true), mock);
        await request(app)
            .get(`/api/loc-request/${ REQUEST_ID }`)
            .expect(200)
            .expect('Content-Type', /application\/json/);
    });

    it('fails to get single LOC if unselected verified issuer', async () => {
        const mock = mockAuthenticationForUserOrLegalOfficer(false, ISSUER.address);
        const app = setupApp(LocRequestController, container => mockModelForGetSingle(container, 'Identity','EmbeddedInLoc', 'UNSELECTED'), mock);
        await request(app)
            .get(`/api/loc-request/${ REQUEST_ID }`)
            .expect(403);
    });

    it('fails to get single LOC when LLO without Vote', async () => {
        const mock = mockAuthenticationForUserOrLegalOfficer(true, BOB);
        const app = setupApp(LocRequestController, container => mockModelForGetSingle(container, 'Identity','EmbeddedInLoc', 'NOT_ISSUER', false), mock);
        await request(app)
            .get(`/api/loc-request/${ REQUEST_ID }`)
            .expect(403);
    });
});

function mockModelForFetch(container: Container): void {
    const { request, repository, loc } = buildMocksForFetch(container);

    setupRequest(request, REQUEST_ID, "Transaction", "REVIEW_REJECTED", testDataWithUserIdentity);
    mockOwner(request, ALICE_ACCOUNT);
    mockRequester(request, SUBMITTER);

    request.setup(instance => instance.rejectReason)
        .returns(REJECT_REASON);

    setupSelectedIssuer(loc, 'NOT_ISSUER');
    repository.setup(instance => instance.findBy)
        .returns(() => Promise.resolve([ request.object() ]));
}

const REJECT_REASON = "Illegal";

function mockModelForGetSingle(
    container: Container,
    locType: LocType,
    identityLocation: IdentityLocation,
    issuerMode: SetupIssuerMode = 'NOT_ISSUER',
    voteExists = true
): void {
    const { request, repository, voteRepository, loc } = buildMocksForFetch(container);

    const data =
        identityLocation === "EmbeddedInLoc" ?
            testDataWithUserIdentityWithType(locType) :
            identityLocation === "Polkadot" ? testDataWithType(locType) :
                testDataWithLogionIdentity;
    const description: Partial<LocRequestDescription> = {
        ...data,
        requesterAddress: SUBMITTER
    };
    setupRequest(request, REQUEST_ID, "Transaction", "CLOSED", description,
        [ testFile ],
        [ testMetadataItem ],
        [ testLink ],
    );

    mockPolkadotIdentityLoc(repository, identityLocation === "Polkadot");
    mockLogionIdentityLoc(repository, identityLocation === "Logion");

    setupSelectedIssuer(loc, issuerMode);
    setUpVote(voteRepository, voteExists);
}

const SUBMITTER = polkadotAccount("5DDGQertEH5qvKVXUmpT3KNGViCX582Qa2WWb8nGbkmkRHvw");

const FILE_FEES = new Fees({ inclusionFee: 42n, storageFee: 24n });
const testFile: FileDescription = {
    name: "test-file",
    nature: "file-nature",
    contentType: "application/pdf",
    hash: Hash.fromHex("0x9383cd5dfeb5870027088289c665c3bae2d339281840473f35311954e984dea9"),
    oid: 123,
    submitter: SUBMITTER,
    addedOn: moment("2022-08-31T15:53:12.741Z"),
    restrictedDelivery: false,
    size: 123,
    fees: FILE_FEES,
    storageFeePaidBy: testData.requesterAddress?.address,
    status: "ACKNOWLEDGED",
    acknowledgedByOwnerOn: moment(),
    acknowledgedByVerifiedIssuerOn: moment(),
}

const DATA_LINK_FEES = new Fees({ inclusionFee: 42n });
const testLink: LinkDescription = {
    target: "507a00a1-7387-44b8-ac4d-fa57ccbf6da5",
    nature: "link-nature",
    submitter: SUBMITTER,
    fees: DATA_LINK_FEES,
    status: "ACKNOWLEDGED",
}

const testMetadataItem: MetadataItemDescription = {
    name: "test-data",
    nameHash: Hash.of("test-data"),
    value: "test-data-value",
    submitter: SUBMITTER,
    fees: DATA_LINK_FEES,
    status: "ACKNOWLEDGED",
    acknowledgedByOwnerOn: moment(),
    acknowledgedByVerifiedIssuerOn: moment(),
}

async function testGet(app: ReturnType<typeof setupApp>, expectedUserPrivateData: UserPrivateData) {
    await request(app)
        .get(`/api/loc-request/${ REQUEST_ID }`)
        .expect(200)
        .expect('Content-Type', /application\/json/)
        .then(response => {
            expect(response.body.id).toBe(REQUEST_ID);
            expect(response.body.voteId).toBe(VOTE_ID);
            expect(response.body.legalFee).toBeDefined();
            const file = response.body.files[0]
            expect(file.name).toBe(testFile.name)
            expect(file.nature).toBe(testFile.nature)
            expect(file.hash).toBe(testFile.hash.toHex())
            expect(file.addedOn).toBe(testFile.addedOn?.toISOString())
            expect(file.submitter).toEqual(SUBMITTER)
            expect(file.fees.inclusion).toBe(FILE_FEES.inclusionFee.toString())
            expect(file.fees.storage).toBe(FILE_FEES.storageFee?.toString())
            expect(file.storageFeePaidBy).toBe(testData.requesterAddress?.address)
            expect(file.status).toBe(testFile.status)
            expect(file.acknowledgedByOwnerOn).toBeDefined()
            expect(file.acknowledgedByVerifiedIssuerOn).toBeDefined()
            const link = response.body.links[0]
            expect(link.nature).toBe(testLink.nature)
            expect(link.target).toBe(testLink.target)
            expect(link.addedOn).toBe(testLink.addedOn?.toISOString())
            expect(link.fees.inclusion).toBe(DATA_LINK_FEES.inclusionFee.toString())
            const metadataItem = response.body.metadata[0]
            expect(metadataItem.name).toBe(testMetadataItem.name)
            expect(metadataItem.value).toBe(testMetadataItem.value)
            expect(metadataItem.addedOn).toBe(testMetadataItem.addedOn?.toISOString())
            expect(metadataItem.submitter).toEqual(SUBMITTER)
            expect(metadataItem.fees.inclusion).toBe(DATA_LINK_FEES.inclusionFee.toString())
            expect(metadataItem.status).toBe(testMetadataItem.status)
            expect(metadataItem.acknowledgedByOwnerOn).toBeDefined()
            expect(metadataItem.acknowledgedByVerifiedIssuerOn).toBeDefined()
            checkPrivateData(response, expectedUserPrivateData);
        });
}
