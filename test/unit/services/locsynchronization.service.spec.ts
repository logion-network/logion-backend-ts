import { UUID } from "@logion/node-api";
import moment, { Moment } from 'moment';
import { It, Mock } from 'moq.ts';
import { LocSynchronizer } from "../../../src/logion/services/locsynchronization.service";
import { LocRequestAggregateRoot, LocRequestRepository } from '../../../src/logion/model/locrequest.model';
import { JsonExtrinsic } from '../../../src/logion/services/types/responses/Extrinsic';
import { JsonArgs } from '../../../src/logion/services/call';
import {
    CollectionFactory,
    CollectionRepository,
    CollectionItemAggregateRoot,
    CollectionItemDescription
} from "../../../src/logion/model/collection.model";
import { NonTransactionalLocRequestService } from "../../../src/logion/services/locrequest.service";

describe("LocSynchronizer", () => {

    beforeEach(() => {
        locRequestRepository = new Mock<LocRequestRepository>();
        collectionFactory = new Mock<CollectionFactory>();
        collectionRepository = new Mock<CollectionRepository>();
    });

    it("sets LOC created date", async () => {

        const palletMethods = [
            "createLogionIdentityLoc",
            "createLogionTransactionLoc",
            "createPolkadotIdentityLoc",
            "createPolkadotTransactionLoc",
            "createCollectionLoc"
        ]

        for (const palletMethod of palletMethods) {

            givenLocExtrinsic(palletMethod, { loc_id: locId });
            givenLocRequest();
            givenLocRequestExpectsLocCreationDate();
            await whenConsumingBlock();
            thenLocCreateDateSet();
            thenLocIsSaved();
        }
    });

    it("sets metadata item added on", async () => {
        givenLocExtrinsic("addMetadata", {
            loc_id: locId,
            item: {
                name: METADATA_ITEM_NAME,
                value: METADATA_ITEM_VALUE,
            }
        });
        givenLocRequest();
        givenLocRequestExpectsMetadataTimestamped();
        await whenConsumingBlock();
        thenMetadataTimestamped();
        thenLocIsSaved();
    });

    it("closes LOC", async () => {
        givenLocExtrinsic("close", { loc_id: locId });
        givenLocRequest();
        givenLocRequestExpectsClose();
        await whenConsumingBlock();
        thenLocClosed();
        thenLocIsSaved();
    });

    it("sets link added on", async () => {
        givenLocExtrinsic("addLink", {
            loc_id: locId,
            link: {
                id: LINK_TARGET,
                nature: LINK_NATURE,
            }
        });
        givenLocRequest();
        givenLocRequestExpectsLinkTimestamped();
        await whenConsumingBlock();
        thenLinkTimestamped();
        thenLocIsSaved();
    });

    it("voids LOC on makeVoid", async () => {
        givenLocExtrinsic("makeVoid", { loc_id: locId });
        givenLocRequest();
        givenLocRequestExpectsVoid();
        await whenConsumingBlock();
        thenLocVoided();
        thenLocIsSaved();
    });

    it("voids LOC on makeVoidAndReplace", async () => {
        givenLocExtrinsic("makeVoidAndReplace", { loc_id: locId });
        givenLocRequest();
        givenLocRequestExpectsVoid();
        await whenConsumingBlock();
        thenLocVoided();
        thenLocIsSaved();
    });

    it("adds Collection Item", async () => {
        givenLocExtrinsic("addCollectionItem", { collection_loc_id: locId, item_id: itemId});
        givenLocRequest();
        givenCollectionItem();
        givenCollectionFactory();
        await whenConsumingBlock();
        thenCollectionItemSaved();
    });

    it("adds Collection Item with terms and conditions", async () => {
        givenLocExtrinsic("addCollectionItemWithTermsAndConditions", { collection_loc_id: locId, item_id: itemId });
        givenLocRequest();
        givenCollectionItem();
        givenCollectionFactory();
        await whenConsumingBlock();
        thenCollectionItemSaved();
    });

    it("throws with unknown extrinsic", async () => {
        givenLocExtrinsic("unknownExtrinsic", {});
        givenLocRequest();
        givenCollectionItem();
        givenCollectionFactory();
        await expectAsync(whenConsumingBlock()).toBeRejected();
    });
});

const locDecimalUuid = "130084474896785895402627605545662412605";
const locId = locDecimalUuid;
const locIdUuid = UUID.fromDecimalStringOrThrow(locDecimalUuid).toString();
const itemIdHex = "0x818f1c9cd44ed4ca11f2ede8e865c02a82f9f8a158d8d17368a6818346899705";
const itemId = itemIdHex;
const blockTimestamp = moment();
let locRequestRepository: Mock<LocRequestRepository>;
let collectionFactory: Mock<CollectionFactory>;
let collectionRepository: Mock<CollectionRepository>;

function givenLocExtrinsic(method: string, args: JsonArgs) {
    locExtrinsic = new Mock<JsonExtrinsic>();
    locExtrinsic.setup(instance => instance.call).returns({
        section: "logionLoc",
        method,
        args,
    });
    locExtrinsic.setup(instance => instance.error).returns(() => null);
}

let locExtrinsic: Mock<JsonExtrinsic>;

function givenLocRequest() {
    locRequest = new Mock<LocRequestAggregateRoot>();
    locRequestRepository.setup(instance => instance.findById(locIdUuid)).returns(Promise.resolve(locRequest.object()));
    locRequestRepository.setup(instance => instance.save(locRequest.object())).returns(Promise.resolve());
}

function givenCollectionItem() {
    collectionItem = new Mock<CollectionItemAggregateRoot>()
    collectionRepository.setup(instance => instance.findBy(locIdUuid, itemIdHex)).returns(Promise.resolve(null));
    collectionRepository.setup(instance => instance.save(collectionItem.object())).returns(Promise.resolve());
}

function givenCollectionFactory() {
    collectionFactory.setup(instance => instance.newItem(It.Is<CollectionItemDescription>(params =>
        params.collectionLocId === locIdUuid &&
        params.itemId === itemIdHex &&
        params.addedOn !== undefined
    ))).returns(collectionItem.object())
}

let locRequest: Mock<LocRequestAggregateRoot>;
let collectionItem: Mock<CollectionItemAggregateRoot>;

function givenLocRequestExpectsLocCreationDate() {
    locRequest.setup(instance => instance.setLocCreatedDate(IS_BLOCK_TIME))
        .returns(undefined);
}

const IS_BLOCK_TIME = It.Is<Moment>(time => time.isSame(blockTimestamp));

async function whenConsumingBlock() {
    await locSynchronizer().updateLocRequests(locExtrinsic.object(), blockTimestamp);
}

function locSynchronizer(): LocSynchronizer {
    return new LocSynchronizer(
        locRequestRepository.object(),
        collectionFactory.object(),
        collectionRepository.object(),
        new NonTransactionalLocRequestService(locRequestRepository.object()),
    );
}

function thenLocCreateDateSet() {
    locRequest.verify(instance => instance.setLocCreatedDate(IS_BLOCK_TIME));
}

function thenLocIsSaved() {
    locRequestRepository.verify(instance => instance.save(locRequest.object()));
}

function givenLocRequestExpectsMetadataTimestamped() {
    locRequest.setup(instance => instance.setMetadataItemAddedOn(IS_EXPECTED_NAME, IS_BLOCK_TIME)).returns(undefined);
}

const IS_EXPECTED_NAME = It.Is<string>(name => name === METADATA_ITEM_NAME)

const METADATA_ITEM_NAME = "name";
const METADATA_ITEM_VALUE = "value";

function thenMetadataTimestamped() {
    locRequest.verify(instance => instance.setMetadataItemAddedOn(IS_EXPECTED_NAME, IS_BLOCK_TIME));
}

function givenLocRequestExpectsClose() {
    locRequest.setup(instance => instance.close(IS_BLOCK_TIME)).returns(undefined);
}

function thenLocClosed() {
    locRequest.verify(instance => instance.close(IS_BLOCK_TIME));
}

const LINK_TARGET = "130084474896785895402627605545662412605";
const LINK_TARGET_UUID = UUID.fromDecimalStringOrThrow(LINK_TARGET).toString();
const LINK_NATURE = "nature";
const IS_EXPECTED_TARGET = It.Is<string>(target => target === LINK_TARGET_UUID)

function givenLocRequestExpectsLinkTimestamped() {
    locRequest.setup(instance => instance.setLinkAddedOn(IS_EXPECTED_TARGET, IS_BLOCK_TIME)).returns(undefined);
}

function thenLinkTimestamped() {
    locRequest.verify(instance => instance.setLinkAddedOn(IS_EXPECTED_TARGET, IS_BLOCK_TIME));
}

function givenLocRequestExpectsVoid() {
    locRequest.setup(instance => instance.voidLoc(IS_BLOCK_TIME)).returns(undefined);
}

function thenLocVoided() {
    locRequest.verify(instance => instance.voidLoc(IS_BLOCK_TIME));
}

function thenCollectionItemSaved() {
    collectionRepository.verify(instance => instance.save(collectionItem.object()))
}
