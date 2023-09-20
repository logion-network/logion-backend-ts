import { UUID, TypesJsonObject, Fees } from "@logion/node-api";
import { PolkadotService } from "@logion/rest-api-core";
import moment, { Moment } from 'moment';
import { It, Mock } from 'moq.ts';
import { LocSynchronizer } from "../../../src/logion/services/locsynchronization.service.js";
import { LocRequestAggregateRoot, LocRequestRepository } from '../../../src/logion/model/locrequest.model.js';
import { JsonExtrinsic } from '../../../src/logion/services/types/responses/Extrinsic.js';
import {
    CollectionFactory,
    CollectionRepository,
    CollectionItemAggregateRoot,
    CollectionItemDescription
} from "../../../src/logion/model/collection.model.js";
import { NonTransactionalLocRequestService } from "../../../src/logion/services/locrequest.service.js";
import { NonTransactionalCollectionService } from "../../../src/logion/services/collection.service.js";
import { NotificationService } from "../../../src/logion/services/notification.service.js";
import { DirectoryService } from "../../../src/logion/services/directory.service.js";
import { VerifiedIssuerSelectionService } from "src/logion/services/verifiedissuerselection.service.js";
import { NonTransactionalTokensRecordService } from "../../../src/logion/services/tokensrecord.service.js";
import { TokensRecordFactory, TokensRecordRepository } from "../../../src/logion/model/tokensrecord.model.js";
import { ALICE } from "../../helpers/addresses.js";
import { Hash } from "../../../src/logion/lib/crypto/hashing.js";
import { ItIsAccount, ItIsHash } from "../../helpers/Mock.js";
import { SupportedAccountId } from "src/logion/model/supportedaccountid.model.js";

describe("LocSynchronizer", () => {

    beforeEach(() => {
        locRequestRepository = new Mock<LocRequestRepository>();
        collectionFactory = new Mock<CollectionFactory>();
        collectionRepository = new Mock<CollectionRepository>();
        notificationService = new Mock();
        directoryService = new Mock();
        polkadotService = new Mock();
        verifiedIssuerSelectionService = new Mock();
        tokensRecordFactory = new Mock();
        tokensRecordRepository = new Mock();
    });

    it("sets LOC created date", async () => {

        const palletMethods = [
            "createLogionIdentityLoc",
            "createLogionTransactionLoc",
            "createPolkadotIdentityLoc",
            "createPolkadotTransactionLoc",
            "createCollectionLoc",
            "createOtherIdentityLoc"
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

    it("updates metadata item", async () => {
        givenLocExtrinsic("addMetadata", {
            loc_id: locId,
            item: {
                name: METADATA_ITEM_NAME_HASH.toHex(),
                value: METADATA_ITEM_VALUE,
            }
        });
        givenLocRequest();
        givenLocRequestExpectsMetadataItemUpdated();
        await whenConsumingBlock();
        thenMetadataUpdated();
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

    it("updates link", async () => {
        givenLocExtrinsic("addLink", {
            loc_id: locId,
            link: {
                id: LINK_TARGET,
                nature: LINK_NATURE,
            }
        });
        givenLocRequest();
        givenLocRequestExpectsLinkUpdated();
        await whenConsumingBlock();
        thenLinkUpdated();
        thenLocIsSaved();
    });

    it("updates file", async () => {
        givenLocExtrinsic("addFile", {
            loc_id: locId,
            file: {
                hash: FILE_HASH.toHex(),
            }
        });
        givenLocRequest();
        givenLocRequestExpectsFileUpdated();
        await whenConsumingBlock();
        thenFileUpdated();
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
        givenLocExtrinsic("addCollectionItem", { collection_loc_id: locId, item_id: itemId.toHex()});
        givenLocRequest();
        givenCollectionItem();
        givenCollectionFactory();
        await whenConsumingBlock();
        thenCollectionItemSaved();
    });

    it("adds Collection Item with terms and conditions", async () => {
        givenLocExtrinsic("addCollectionItemWithTermsAndConditions", { collection_loc_id: locId, item_id: itemId.toHex() });
        givenLocRequest();
        givenCollectionItem();
        givenCollectionFactory();
        await whenConsumingBlock();
        thenCollectionItemSaved();
    });

    it("does not throw on skipped extrinsics", async () => {
        const palletMethods = [
            "sponsor",
            "withdrawSponsorship",
        ];
        for (const palletMethod of palletMethods) {
            givenLocExtrinsic(palletMethod, {});
            await whenConsumingBlock();
        }
    });

    it("throws with unknown extrinsic", async () => {
        givenLocExtrinsic("unknownExtrinsic", {});
        givenLocRequest();
        givenCollectionItem();
        givenCollectionFactory();
        await expectAsync(whenConsumingBlock()).toBeRejected();
    });

    it("confirms metadata acknowledged", async () => {
        givenLocExtrinsic("acknowledgeMetadata", {
            loc_id: locId,
            name: METADATA_ITEM_NAME_HASH.toHex(),
        });
        givenLocRequest();
        givenLocRequestExpectsMetadataItemAcknowledged();
        await whenConsumingBlock();
        thenMetadataAcknowledged();
        thenLocIsSaved();
    });

    it("confirms file acknowledged", async () => {
        givenLocExtrinsic("acknowledgeFile", {
            loc_id: locId,
            hash: FILE_HASH.toHex(),
        });
        givenLocRequest();
        givenLocRequestExpectsFileAcknowledged();
        await whenConsumingBlock();
        thenFileAcknowledged();
        thenLocIsSaved();
    });

    it("confirms link acknowledged", async () => {
        givenLocExtrinsic("acknowledgeLink", {
            loc_id: locId,
            target: LINK_TARGET,
        });
        givenLocRequest();
        givenLocRequestExpectsLinkAcknowledged();
        await whenConsumingBlock();
        thenLinkAcknowledged();
        thenLocIsSaved();
    });
});

const locDecimalUuid = "130084474896785895402627605545662412605";
const locId = locDecimalUuid;
const locIdUuid = UUID.fromDecimalStringOrThrow(locDecimalUuid).toString();
const itemIdHex = "0x818f1c9cd44ed4ca11f2ede8e865c02a82f9f8a158d8d17368a6818346899705";
const itemId = Hash.fromHex(itemIdHex);
const blockTimestamp = moment();
let locRequestRepository: Mock<LocRequestRepository>;
let collectionFactory: Mock<CollectionFactory>;
let collectionRepository: Mock<CollectionRepository>;

function givenLocExtrinsic(method: string, args: TypesJsonObject) {
    locExtrinsic = new Mock<JsonExtrinsic>();
    locExtrinsic.setup(instance => instance.call).returns({
        section: "logionLoc",
        method,
        args,
    });
    locExtrinsic.setup(instance => instance.error).returns(() => null);
    locExtrinsic.setup(instance => instance.partialFee()).returnsAsync("42");
    locExtrinsic.setup(instance => instance.signer).returns(ALICE);
    if(method === "addFile") {
        locExtrinsic.setup(instance => instance.storageFee).returns({
            fee: 24n,
            withdrawnFrom: ALICE
        });
    }
}

let locExtrinsic: Mock<JsonExtrinsic>;

function givenLocRequest() {
    locRequest = new Mock<LocRequestAggregateRoot>();
    locRequestRepository.setup(instance => instance.findById(locIdUuid)).returns(Promise.resolve(locRequest.object()));
    locRequestRepository.setup(instance => instance.save(locRequest.object())).returns(Promise.resolve());
}

function givenCollectionItem() {
    collectionItem = new Mock<CollectionItemAggregateRoot>();
    collectionItem.setup(instance => instance.confirm(It.IsAny())).returns();
    collectionRepository.setup(instance => instance.findBy(locIdUuid, ItIsHash(itemId))).returns(Promise.resolve(collectionItem.object()));
    collectionRepository.setup(instance => instance.save(collectionItem.object())).returns(Promise.resolve());
}

function givenCollectionFactory() {
    collectionFactory.setup(instance => instance.newItem(It.Is<CollectionItemDescription>(params =>
        params.collectionLocId === locIdUuid &&
        params.itemId.equalTo(itemId) &&
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
        new NonTransactionalLocRequestService(locRequestRepository.object()),
        new NonTransactionalCollectionService(collectionRepository.object()),
        notificationService.object(),
        directoryService.object(),
        polkadotService.object(),
        verifiedIssuerSelectionService.object(),
        new NonTransactionalTokensRecordService(tokensRecordRepository.object()),
        tokensRecordFactory.object(),
    );
}

let notificationService: Mock<NotificationService>;
let directoryService: Mock<DirectoryService>;
let polkadotService: Mock<PolkadotService>;
let verifiedIssuerSelectionService: Mock<VerifiedIssuerSelectionService>;
let tokensRecordRepository: Mock<TokensRecordRepository>;
let tokensRecordFactory: Mock<TokensRecordFactory>;

function thenLocCreateDateSet() {
    locRequest.verify(instance => instance.setLocCreatedDate(IS_BLOCK_TIME));
}

function thenLocIsSaved() {
    locRequestRepository.verify(instance => instance.save(locRequest.object()));
}

function givenLocRequestExpectsMetadataItemUpdated() {
    locRequest.setup(instance => instance.setMetadataItemAddedOn(IS_EXPECTED_NAME_HASH, IS_BLOCK_TIME)).returns(undefined);
    locRequest.setup(instance => instance.setMetadataItemFee(IS_EXPECTED_NAME_HASH, 42n)).returns(undefined);
}

const METADATA_ITEM_NAME = "name";
const METADATA_ITEM_NAME_HASH = Hash.of(METADATA_ITEM_NAME);
const METADATA_ITEM_VALUE = "value";
const IS_EXPECTED_NAME_HASH = ItIsHash(METADATA_ITEM_NAME_HASH);

function thenMetadataUpdated() {
    locRequest.verify(instance => instance.setMetadataItemAddedOn(IS_EXPECTED_NAME_HASH, IS_BLOCK_TIME));
    locRequest.verify(instance => instance.setMetadataItemFee(IS_EXPECTED_NAME_HASH, 42n));
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

function givenLocRequestExpectsLinkUpdated() {
    locRequest.setup(instance => instance.setLinkAddedOn(IS_EXPECTED_TARGET, IS_BLOCK_TIME)).returns(undefined);
    locRequest.setup(instance => instance.setLinkFee(IS_EXPECTED_TARGET, 42n)).returns(undefined);
}

function thenLinkUpdated() {
    locRequest.verify(instance => instance.setLinkAddedOn(IS_EXPECTED_TARGET, IS_BLOCK_TIME));
    locRequest.verify(instance => instance.setLinkFee(IS_EXPECTED_TARGET, 42n));
}

function givenLocRequestExpectsFileUpdated() {
    locRequest.setup(instance => instance.setFileAddedOn(ItIsHash(FILE_HASH), IS_BLOCK_TIME)).returns(undefined);
    locRequest.setup(instance => instance.setFileFees(ItIsHash(FILE_HASH), IS_EXPECTED_FEES, ALICE)).returns(undefined);
}

const FILE_HASH = Hash.fromHex("0x37f1c3d493ad2320d7cc935446c9e094249b5070988820b864b417b708695ed7");
const IS_EXPECTED_FEES = It.Is<Fees>(fees => fees.inclusionFee === 42n && fees.storageFee === 24n);

function thenFileUpdated() {
    locRequest.verify(instance => instance.setFileAddedOn(ItIsHash(FILE_HASH), IS_BLOCK_TIME));
    locRequest.verify(instance => instance.setFileFees(ItIsHash(FILE_HASH), IS_EXPECTED_FEES, ALICE));
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

function givenLocRequestExpectsMetadataItemAcknowledged() {
    locRequest.setup(instance => instance.confirmMetadataItemAcknowledged(IS_EXPECTED_NAME_HASH, ItIsAccount(ALICE), IS_BLOCK_TIME)).returns(undefined);
}

function thenMetadataAcknowledged() {
    locRequest.verify(instance => instance.confirmMetadataItemAcknowledged(IS_EXPECTED_NAME_HASH, ItIsAccount(ALICE), IS_BLOCK_TIME));
}

function givenLocRequestExpectsFileAcknowledged() {
    locRequest.setup(instance => instance.confirmFileAcknowledged(ItIsHash(FILE_HASH), ItIsAccount(ALICE), IS_BLOCK_TIME)).returns(undefined);
}

function thenFileAcknowledged() {
    locRequest.verify(instance => instance.confirmFileAcknowledged(ItIsHash(FILE_HASH), ItIsAccount(ALICE), IS_BLOCK_TIME));
}

function givenLocRequestExpectsLinkAcknowledged() {
    locRequest.setup(instance => instance.confirmLinkAcknowledged(IS_EXPECTED_TARGET, ItIsAccount(ALICE), IS_BLOCK_TIME)).returns(undefined);
}

function thenLinkAcknowledged() {
    locRequest.verify(instance => instance.confirmLinkAcknowledged(IS_EXPECTED_TARGET, ItIsAccount(ALICE), IS_BLOCK_TIME));
}
