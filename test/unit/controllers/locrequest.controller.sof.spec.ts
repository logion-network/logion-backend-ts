import { TestApp } from "@logion/rest-api-core";
import { LocRequestController } from "../../../src/logion/controllers/locrequest.controller.js";
import { Container } from "inversify";
import request from "supertest";
import { Mock, It } from "moq.ts";
import {
    LocRequestFactory,
    LocType,
    NewSofRequestParameters,
} from "../../../src/logion/model/locrequest.model.js";
import { Hash, UUID } from "@logion/node-api";
import { CollectionItemAggregateRoot } from "../../../src/logion/model/collection.model.js";
import {
    buildMocksForUpdate,
    mockPolkadotIdentityLoc,
    mockRequest,
    REQUEST_ID,
    setupRequest,
    setupSelectedIssuer,
    mockOwner,
    testDataWithType
} from "./locrequest.controller.shared.js";
import { ALICE_ACCOUNT } from "../../helpers/addresses.js";
import { ItIsHash } from "../../helpers/Mock.js";

const { setupApp } = TestApp;

describe('LocRequestController - SoF -', () => {

    it('creates a SOF request for Transaction LOC', async () => {
        const factory = new Mock<LocRequestFactory>();
        const LOC_ID = new UUID("ebf12a7a-f25f-4830-bd91-d0a7051f641e");
        const app = setupApp(LocRequestController, container => mockModelForCreateSofRequest(container, factory, 'Transaction', LOC_ID))
        await request(app)
            .post(`/api/loc-request/sof`)
            .send({
                locId: LOC_ID.toString(),
                legalFee: "2000",
            })
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.id).toBe(REQUEST_ID);
                expect(response.body.status).toBe("REVIEW_PENDING");
            })
        factory.verify(instance => instance.newSofRequest(It.Is<NewSofRequestParameters>(param =>
                param.description.description === `Statement of Facts for LOC ${ LOC_ID.toDecimalString() }` &&
                param.nature === "Original LOC"))
        )
    })

    it('creates a SOF request for Collection LOC', async () => {
        const factory = new Mock<LocRequestFactory>();
        const LOC_ID = new UUID("ebf12a7a-f25f-4830-bd91-d0a7051f641e");
        const itemId = Hash.fromHex("0x6dec991b1b61b44550769ae3c4b7f54f7cd618391f32bab2bc4e3a96cbb2b198");
        const app = setupApp(LocRequestController, container => mockModelForCreateSofRequest(container, factory, 'Collection', LOC_ID, itemId))
        await request(app)
            .post(`/api/loc-request/sof`)
            .send({
                locId: LOC_ID.toString(),
                itemId: itemId.toHex(),
                legalFee: "2000",
            })
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.id).toBe(REQUEST_ID);
                expect(response.body.status).toBe("REVIEW_PENDING");
            })
        factory.verify(instance => instance.newSofRequest(It.Is<NewSofRequestParameters>(param =>
            param.description.description === `Statement of Facts for LOC ${ LOC_ID.toDecimalString() } - ${ itemId }` &&
            param.nature === `Original LOC - Collection Item: ${ itemId }`))
        )
    })
})

function mockModelForCreateSofRequest(container: Container, factory: Mock<LocRequestFactory>, locType: LocType, locId: UUID, itemId?: Hash) {
    const { request, repository, collectionRepository, loc } = buildMocksForUpdate(container, { factory });

    const targetLoc = mockRequest("CLOSED", testDataWithType(locType));
    targetLoc.setup(instance => instance.id).returns(locId.toString());
    targetLoc.setup(instance => instance.locType).returns(locType);
    mockOwner(targetLoc, ALICE_ACCOUNT);
    repository.setup(instance => instance.findById(locId.toString()))
        .returns(Promise.resolve(targetLoc.object()));

    setupRequest(request, REQUEST_ID, locType, "REVIEW_PENDING", testDataWithType(locType));

    factory.setup(instance => instance.newSofRequest(It.IsAny<NewSofRequestParameters>()))
        .returns(Promise.resolve(request.object()));

    mockPolkadotIdentityLoc(repository, true);

    if (locType === 'Collection' && itemId) {
        const collectionItem = new Mock<CollectionItemAggregateRoot>();
        collectionItem.setup(instance => instance.itemId)
            .returns(itemId.toHex());
        collectionRepository.setup(instance => instance.findBy(locId.toString(), ItIsHash(itemId)))
            .returns(Promise.resolve(collectionItem.object()));
    }

    setupSelectedIssuer(loc, 'NOT_ISSUER');

}
