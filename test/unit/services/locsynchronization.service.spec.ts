import moment, { Moment } from 'moment';
import { It, Mock } from 'moq.ts';

import { BlockExtrinsics } from '../../../src/logion/services/types/responses/Block';
import { LocSynchronizer } from "../../../src/logion/services/locsynchronization.service";
import { ExtrinsicDataExtractor } from '../../../src/logion/services/extrinsic.data.extractor';
import { LocRequestAggregateRoot, LocRequestRepository, MetadataItemDescription } from '../../../src/logion/model/locrequest.model';
import { JsonExtrinsic } from '../../../src/logion/services/types/responses/Extrinsic';
import { JsonArgs } from '../../../src/logion/services/call';
import { decimalToUuid } from '../../../src/logion/lib/uuid';

describe("LocSynchronizer", () => {

    beforeEach(() => {
        extrinsicDataExtractor = new Mock<ExtrinsicDataExtractor>();
        locRequestRepository = new Mock<LocRequestRepository>();
    });

    it("sets LOC created date", async () => {
        givenLocExtrinsic("createLoc", { loc_id: locId });
        givenBlock();
        givenLocRequest();
        givenLocRequestExpectsLocCreationDate();
        await whenConsumingBlock();
        thenLocCreateDateSet();
        thenLocIsSaved();
    });

    it("adds metadata", async () => {
        givenLocExtrinsic("addMetadata", {
            loc_id: locId,
            item: {
                name: {
                    toUtf8: () => METADATA_ITEM_NAME
                },
                value: {
                    toUtf8: () => METADATA_ITEM_VALUE
                },
            }
        });
        givenBlock();
        givenLocRequest();
        givenLocRequestExpectsMetadata();
        await whenConsumingBlock();
        thenMetadataAdded();
        thenLocIsSaved();
    });

    it("closes LOC", async () => {
        givenLocExtrinsic("close", { loc_id: locId });
        givenBlock();
        givenLocRequest();
        givenLocRequestExpectsClose();
        await whenConsumingBlock();
        thenLocClosed();
        thenLocIsSaved();
    });
});

const locId = {
    toString: () => locDecimalUuid
};
const locDecimalUuid = "130084474896785895402627605545662412605";
const blockTimestamp = moment();
let extrinsicDataExtractor: Mock<ExtrinsicDataExtractor>;
let locRequestRepository: Mock<LocRequestRepository>;

function givenLocExtrinsic(method: string, args: JsonArgs) {
    locExtrinsic = new Mock<JsonExtrinsic>();
    locExtrinsic.setup(instance => instance.method).returns({
        pallet: "logionLoc",
        method,
    });
    locExtrinsic.setup(instance => instance.args).returns(args);
}

let locExtrinsic: Mock<JsonExtrinsic>;

function givenBlock() {
    block = new Mock<BlockExtrinsics>();
    extrinsicDataExtractor.setup(instance => instance.getBlockTimestamp(block.object())).returns(blockTimestamp);
    const extrinsics: JsonExtrinsic[] = [ locExtrinsic.object() ];
    block.setup(instance => instance.extrinsics).returns(extrinsics);
}

let block: Mock<BlockExtrinsics>;

function givenLocRequest() {
    locRequest = new Mock<LocRequestAggregateRoot>();
    locRequestRepository.setup(instance => instance.findById(decimalToUuid(locDecimalUuid))).returns(Promise.resolve(locRequest.object()));
    locRequestRepository.setup(instance => instance.save(locRequest.object())).returns(Promise.resolve());
}

let locRequest: Mock<LocRequestAggregateRoot>;

function givenLocRequestExpectsLocCreationDate() {
    locRequest.setup(instance => instance.setLocCreatedDate(IS_BLOCK_TIME))
        .returns(undefined);
}

const IS_BLOCK_TIME = It.Is<Moment>(time => time.isSame(blockTimestamp));

async function whenConsumingBlock() {
    await locSynchronizer().updateLocRequests(block.object());
}

function locSynchronizer(): LocSynchronizer {
    return new LocSynchronizer(
        extrinsicDataExtractor.object(),
        locRequestRepository.object(),
    );
}

function thenLocCreateDateSet() {
    locRequest.verify(instance => instance.setLocCreatedDate(IS_BLOCK_TIME));
}

function thenLocIsSaved() {
    locRequestRepository.verify(instance => instance.save(locRequest.object()));
}

function givenLocRequestExpectsMetadata() {
    locRequest.setup(instance => instance.addMetadataItem(IS_EXPECTED_ITEM)).returns(undefined);
}

const IS_EXPECTED_ITEM = It.Is<MetadataItemDescription>(item =>
            item.name === METADATA_ITEM_NAME
            && item.value === METADATA_ITEM_VALUE
            && item.addedOn.isSame(blockTimestamp));

const METADATA_ITEM_NAME = "name";
const METADATA_ITEM_VALUE = "value";

function thenMetadataAdded() {
    locRequest.verify(instance => instance.addMetadataItem(IS_EXPECTED_ITEM));
}

function givenLocRequestExpectsClose() {
    locRequest.setup(instance => instance.close(IS_BLOCK_TIME)).returns(undefined);
}

function thenLocClosed() {
    locRequest.verify(instance => instance.close(IS_BLOCK_TIME));
}
