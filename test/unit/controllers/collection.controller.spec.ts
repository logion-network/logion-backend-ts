import { setupApp } from "../../helpers/testapp";
import { CollectionController } from "../../../src/logion/controllers/collection.controller";
import { Container } from "inversify";
import { Mock } from "moq.ts";
import { CollectionRepository, CollectionItemAggregateRoot } from "../../../src/logion/model/collection.model";
import moment from "moment";
import request from "supertest";

const collectionLocId = "d61e2e12-6c06-4425-aeee-2a0e969ac14e";
const itemId = "0x818f1c9cd44ed4ca11f2ede8e865c02a82f9f8a158d8d17368a6818346899705";
const timestamp = moment();

describe("CollectionController", () => {

    it("gets an existing collection item", async () => {

        const app = setupApp(CollectionController, mockModelForGet);

        await request(app)
            .get(`/api/collection/${collectionLocId}/${itemId}`)
            .send()
            .expect(200)
            .then(response => {
                expect(response.body.collectionLocId).toEqual(collectionLocId)
                expect(response.body.itemId).toEqual(itemId)
                expect(response.body.addedOn).toEqual(timestamp.toISOString())
            })
    })

    it("gets an error code when requesting non-existent collection item", async () => {

        const app = setupApp(CollectionController, mockModelForGet);

        await request(app)
            .get(`/api/collection/${collectionLocId}/0x12345`)
            .send()
            .expect(400)
            .then(response => {
                expect(response.body.error).toEqual("Collection item d61e2e12-6c06-4425-aeee-2a0e969ac14e/0x12345 not found")
            })
    })
})

function mockModelForGet(container: Container): void {

    const collectionItem = new CollectionItemAggregateRoot()
    collectionItem.collectionLocId = collectionLocId;
    collectionItem.itemId = itemId;
    collectionItem.addedOn = timestamp.toDate();

    const repository = new Mock<CollectionRepository>()
    repository.setup(instance => instance.findBy(collectionLocId, itemId))
        .returns(Promise.resolve(collectionItem))

    container.bind(CollectionRepository).toConstantValue(repository.object())
}
