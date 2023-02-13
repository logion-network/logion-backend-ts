import { LocRequestAdapter, UserPrivateData } from "../../../src/logion/controllers/adapters/locrequestadapter.js";
import { Container } from "inversify";
import request from "supertest";
import { ALICE } from "../../helpers/addresses.js";
import { Mock, It } from "moq.ts";
import {
    LocRequestRepository,
    LocRequestFactory,
    LocRequestAggregateRoot,
    LocRequestStatus,
    FileDescription,
    LinkDescription,
    MetadataItemDescription,
    LocType,
    FetchLocRequestsSpecification,
    IdentityLocType,
    LocRequestDescription,
} from "../../../src/logion/model/locrequest.model.js";
import { FileStorageService } from "../../../src/logion/services/file.storage.service.js";
import { NotificationService, Template } from "../../../src/logion/services/notification.service.js";
import { DirectoryService } from "../../../src/logion/services/directory.service.js";
import { notifiedLegalOfficer } from "../services/notification-test-data.js";
import { CollectionRepository } from "../../../src/logion/model/collection.model.js";
import { LATEST_SEAL_VERSION, PersonalInfoSealService, Seal } from "../../../src/logion/services/seal.service.js";
import { PersonalInfo } from "../../../src/logion/model/personalinfo.model.js";
import { LocRequestService, NonTransactionalLocRequestService } from "../../../src/logion/services/locrequest.service.js";
import { DisabledIdenfyService, IdenfyService } from "../../../src/logion/services/idenfy/idenfy.service.js";
import { VoteRepository, VoteAggregateRoot } from "../../../src/logion/model/vote.model.js";
import { PolkadotService } from "@logion/rest-api-core";
import { LogionNodeApi, UUID } from "@logion/node-api";
import { Option } from "@polkadot/types-codec";
import { PalletLogionLocVerifiedIssuer, PalletLogionLocLegalOfficerCase } from "@polkadot/types/lookup";

export type IdentityLocation = IdentityLocType | 'EmbeddedInLoc';
export const REQUESTER_ADDRESS = "5CXLTF2PFBE89tTYsrofGPkSfGTdmW4ciw4vAfgcKhjggRgZ";

export const userIdentities: Record<IdentityLocation, UserPrivateData> = {
    "Logion": {
        identityLocId: "2d0f662f-2fd1-4ad8-8019-1db74bfc5972",
        userIdentity: {
            firstName: "Felix",
            lastName: "the Cat",
            email: "felix@logion.network",
            phoneNumber: "+0101",
        },
        userPostalAddress: {
            line1: "Rue de la Paix, 1",
            line2: "line2.1",
            postalCode: "1234",
            city: "Liège",
            country: "Belgium"
        },
    },
    "Polkadot": {
        identityLocId: "eb1b554e-f8de-4ea2-bcff-64d0c1f1f237",
        userIdentity: {
            firstName: "Scott",
            lastName: "Tiger",
            email: "scott.tiger@logion.network",
            phoneNumber: "+6789",
        },
        userPostalAddress: {
            line1: "Rue de la Paix, 2",
            line2: "line2.2",
            postalCode: "5678",
            city: "Liège",
            country: "Belgium"
        },
    },
    "EmbeddedInLoc": {
        identityLocId: undefined,
        userIdentity: {
            firstName: "John",
            lastName: "Doe",
            email: "john.doe@logion.network",
            phoneNumber: "+1234",
        },
        userPostalAddress: {
            line1: "Rue de la Paix, 3",
            line2: "line2.3",
            postalCode: "9012",
            city: "Liège",
            country: "Belgium"
        },
    }
}

export function testDataWithType(locType: LocType, draft?: boolean): Partial<LocRequestDescription & { draft: boolean }> {
    return {
        requesterAddress: REQUESTER_ADDRESS,
        ownerAddress: ALICE,
        description: "I want to open a case",
        locType,
        draft,
    }
}

export const SEAL: Seal = {
    hash: "0x5a60f0a435fa1c508ccc7a7dd0a0fe8f924ba911b815b10c9ef0ddea0c49052e",
    salt: "4bdc2a75-5363-4bc0-a71c-41a5781df07c",
    version: 0,
}

export function testDataWithUserIdentityWithType(locType: LocType): Partial<LocRequestDescription> {
    const { userIdentity, userPostalAddress } = userIdentities["EmbeddedInLoc"];
    return {
        ...testDataWithType(locType),
        userIdentity,
        userPostalAddress,
        seal: {
            hash: SEAL.hash,
            version: LATEST_SEAL_VERSION,
        }
    }
}

export const testDataWithUserIdentity = testDataWithUserIdentityWithType("Transaction");

export const testDataWithLogionIdentity: Partial<LocRequestDescription> = {
    requesterIdentityLoc: userIdentities["Logion"].identityLocId,
    ownerAddress: ALICE,
    description: "I want to open a case",
    locType: "Transaction"
};

export interface Mocks {
    factory: Mock<LocRequestFactory>;
    request: Mock<LocRequestAggregateRoot>;
    repository: Mock<LocRequestRepository>;
    fileStorageService: Mock<FileStorageService>;
    notificationService: Mock<NotificationService>;
    collectionRepository: Mock<CollectionRepository>;
    voteRepository: Mock<VoteRepository>;
    nodeApi: Mock<LogionNodeApi>;
    loc: Mock<PalletLogionLocLegalOfficerCase>;
}

export function buildMocks(container: Container, existingMocks?: Partial<Mocks>): Mocks {
    const factory = existingMocks?.factory ? existingMocks.factory : new Mock<LocRequestFactory>();
    container.bind(LocRequestFactory).toConstantValue(factory.object());

    const request = existingMocks?.request ? existingMocks.request  : new Mock<LocRequestAggregateRoot>();

    const repository = existingMocks?.repository ? existingMocks.repository : new Mock<LocRequestRepository>();
    container.bind(LocRequestRepository).toConstantValue(repository.object());

    const fileStorageService = existingMocks?.fileStorageService ? existingMocks.fileStorageService : new Mock<FileStorageService>();
    container.bind(FileStorageService).toConstantValue(fileStorageService.object());

    const { notificationService, collectionRepository } = mockOtherDependencies(container, existingMocks);

    container.bind(LocRequestAdapter).toSelf();

    container.bind(LocRequestService).toConstantValue(new NonTransactionalLocRequestService(repository.object()));

    container.bind(IdenfyService).toConstantValue(new DisabledIdenfyService());

    const voteRepository = existingMocks?.voteRepository ? existingMocks.voteRepository : new Mock<VoteRepository>();
    container.bind(VoteRepository).toConstantValue(voteRepository.object());

    const polkadotService = new Mock<PolkadotService>();
    container.bind(PolkadotService).toConstantValue(polkadotService.object());

    const nodeApi = existingMocks?.nodeApi ? existingMocks.nodeApi : new Mock<LogionNodeApi>();
    polkadotService.setup(instance => instance.readyApi()).returnsAsync(nodeApi.object());

    const loc = existingMocks?.loc ? existingMocks.loc  : new Mock<PalletLogionLocLegalOfficerCase>();

    return {
        factory,
        request,
        repository,
        fileStorageService,
        notificationService,
        collectionRepository,
        voteRepository,
        nodeApi,
        loc,
    };
}

function mockOtherDependencies(container: Container, existingMocks?: {
    notificationService?: Mock<NotificationService>,
    collectionRepository?: Mock<CollectionRepository>,
}): {
    notificationService: Mock<NotificationService>,
    collectionRepository: Mock<CollectionRepository>,
} {
    const notificationService = existingMocks?.notificationService ? existingMocks.notificationService : new Mock<NotificationService>();
    notificationService
        .setup(instance => instance.notify(It.IsAny<string>(), It.IsAny<Template>(), It.IsAny<any>()))
        .returns(Promise.resolve())
    container.bind(NotificationService).toConstantValue(notificationService.object())

    const directoryService = new Mock<DirectoryService>();
    directoryService
        .setup(instance => instance.get(It.IsAny<string>()))
        .returns(Promise.resolve(notifiedLegalOfficer(ALICE)))
    directoryService
        .setup(instance => instance.requireLegalOfficerAddressOnNode(It.IsAny<string>()))
        .returns(Promise.resolve(ALICE));
    container.bind(DirectoryService).toConstantValue(directoryService.object())

    const collectionRepository = existingMocks?.collectionRepository ? existingMocks.collectionRepository : new Mock<CollectionRepository>();
    container.bind(CollectionRepository).toConstantValue(collectionRepository.object())

    const sealService = new Mock<PersonalInfoSealService>();
    sealService
        .setup(instance => instance.seal(It.IsAny<PersonalInfo>(), LATEST_SEAL_VERSION))
        .returns(SEAL);
    container.bind(PersonalInfoSealService).toConstantValue(sealService.object());

    return {
        notificationService,
        collectionRepository,
    }
}

export function mockRequest(
    status: LocRequestStatus,
    data: any,
    files: FileDescription[] = [],
    metadataItems: MetadataItemDescription[] = [],
    links: LinkDescription[] = [],
): Mock<LocRequestAggregateRoot> {
    return mockRequestWithId(REQUEST_ID, undefined, status, data, files, metadataItems, links)
}

export const REQUEST_ID = "3e67427a-d80f-41d7-9c86-75a63b8563a1";

export function mockRequestWithId(
    id: string,
    locType: LocType | undefined,
    status: LocRequestStatus,
    description: Partial<LocRequestDescription> = {},
    files: FileDescription[] = [],
    metadataItems: MetadataItemDescription[] = [],
    links: LinkDescription[] = [],
): Mock<LocRequestAggregateRoot> {
    const request = new Mock<LocRequestAggregateRoot>();
    setupRequest(request, id, locType, status, description, files, metadataItems, links);
    return request;
}

export function setupRequest(
    request: Mock<LocRequestAggregateRoot>,
    id: string,
    locType: LocType | undefined,
    status: LocRequestStatus,
    description: Partial<LocRequestDescription> = {},
    files: FileDescription[] = [],
    metadataItems: MetadataItemDescription[] = [],
    links: LinkDescription[] = [],
) {
    if (locType) {
        request.setup(instance => instance.locType)
            .returns(locType);
    }
    request.setup(instance => instance.status)
        .returns(status);
    request.setup(instance => instance.id)
        .returns(id);
    request.setup(instance => instance.getDescription())
        .returns({
            ...description,
            createdOn: "2022-08-31T16:01:15.651Z",
            ownerAddress: description.ownerAddress || ALICE,
        } as LocRequestDescription);
    request.setup(instance => instance.getFiles(It.IsAny())).returns(files);
    request.setup(instance => instance.getMetadataItems(It.IsAny())).returns(metadataItems);
    request.setup(instance => instance.getLinks(It.IsAny())).returns(links);
    request.setup(instance => instance.getVoidInfo()).returns(null);
    request.setup(instance => instance.ownerAddress).returns(description.ownerAddress || ALICE);
}

export function mockLogionIdentityLoc(repository: Mock<LocRequestRepository>, exists: boolean) {
    const identityLocId = userIdentities["Logion"].identityLocId!;
    const identityLocRequest = exists ?
        mockRequestWithId(identityLocId, "Identity", "CLOSED", logionIdentityLoc).object() :
        null;
    repository.setup(instance => instance.findById(identityLocId))
        .returns(Promise.resolve(identityLocRequest))
}

const logionIdentityLoc: Partial<LocRequestDescription> = {
    description: "Identity LOC",
    locType: "Identity",
    userIdentity: userIdentities["Logion"].userIdentity,
    userPostalAddress: userIdentities["Logion"].userPostalAddress,
}

export function mockPolkadotIdentityLoc(repository: Mock<LocRequestRepository>, exists: boolean) {
    const { userIdentity, userPostalAddress } = userIdentities["Polkadot"]
    const locId = userIdentities["Polkadot"].identityLocId!;
    const identityLocs = exists ?
        [ mockRequestWithId(
            locId,
            "Identity",
            "CLOSED",
            {
                userIdentity,
                userPostalAddress,
            }).object() ] :
        [];

    repository.setup(instance => instance.findBy(It.Is<FetchLocRequestsSpecification>(spec =>
        spec.expectedStatuses !== undefined &&
        spec.expectedStatuses.includes("CLOSED") &&
        spec.expectedLocTypes !== undefined &&
        spec.expectedLocTypes.includes("Identity") &&
        spec.expectedIdentityLocType === "Polkadot"
    ))).returns(Promise.resolve(identityLocs));

    repository.setup(instance => instance.findById(locId)).returnsAsync(identityLocs[0]);
}

export const testData = testDataWithType("Transaction");

export function checkPrivateData(response: request.Response, expectedUserPrivateData: UserPrivateData) {
    expect(response.body.identityLoc).toEqual(expectedUserPrivateData.identityLocId);
    const userIdentity = response.body.userIdentity;
    expect(userIdentity).toEqual(expectedUserPrivateData.userIdentity);
    const userPostalAddress = response.body.userPostalAddress;
    expect(userPostalAddress).toEqual(expectedUserPrivateData.userPostalAddress);
}

export function buildMocksForFetch(container: Container, existingMocks?: Partial<Mocks>): Mocks {
    const mocks = buildMocks(container, existingMocks);

    setupRequestFetch(REQUEST_ID, mocks.request, mocks);
    setupLocFetch(REQUEST_ID, mocks.loc, mocks.nodeApi);

    return mocks;
}

export function setupRequestFetch(requestId: string, request: Mock<LocRequestAggregateRoot>, mocks: Mocks) {
    mocks.repository.setup(instance => instance.findById(requestId))
        .returns(Promise.resolve(request.object()));
}

export function setupLoc(
    loc: Mock<PalletLogionLocLegalOfficerCase>,
    locType: LocType,
    closed: boolean,
    description: Partial<LocRequestDescription> = {},
) {
    loc.setup(instance => instance.owner).returns({ toString: () => description.ownerAddress || ALICE } as any);
    loc.setup(instance => instance.requester).returns({ isAddress: true, asAccount: { toString: () => description.requesterAddress || REQUESTER_ADDRESS }, isLoc: false } as any);
    loc.setup(instance => instance.metadata).returns({ toArray: () => [] } as any);
    loc.setup(instance => instance.files).returns({ toArray: () => [] } as any);
    loc.setup(instance => instance.links).returns({ toArray: () => [] } as any);
    loc.setup(instance => instance.closed).returns({ isTrue: () => closed } as any);
    loc.setup(instance => instance.locType).returns({ toString: () => locType } as any);
    loc.setup(instance => instance.voidInfo).returns({ isSome: false } as any);
    loc.setup(instance => instance.replacerOf).returns({ isSome: false } as any);
    loc.setup(instance => instance.collectionLastBlockSubmission).returns({ isSome: false } as any);
    loc.setup(instance => instance.collectionMaxSize).returns({ isSome: false } as any);
    loc.setup(instance => instance.collectionCanUpload).returns({ isSome: false } as any);
    loc.setup(instance => instance.seal).returns({ isSome: false } as any);
}

export function setupLocFetch(locId: string, loc: Mock<PalletLogionLocLegalOfficerCase> | undefined, nodeApi: Mock<LogionNodeApi>) {
    const maybeLoc = new Mock<Option<PalletLogionLocLegalOfficerCase>>();
    maybeLoc.setup(instance => instance.isSome).returns(loc !== undefined);
    maybeLoc.setup(instance => instance.isNone).returns(loc === undefined);
    if(loc) {
        maybeLoc.setup(instance => instance.unwrap()).returns(loc.object());
    }
    const locIdUuid = new UUID(locId);
    nodeApi.setup(instance => instance.query.logionLoc.locMap(locIdUuid.toHexString())).returnsAsync(maybeLoc.object());
}

export function buildMocksForUpdate(container: Container, existingMocks?: Partial<Mocks>): Mocks {
    const mocks = buildMocksForFetch(container, existingMocks);

    mocks.repository.setup(instance => instance.save(mocks.request.object()))
        .returns(Promise.resolve());

    return mocks;
}

export type SetupVtpMode = 'NOT_VTP' | 'SELECTED' | 'UNSELECTED';

export function setupSelectedVtp(
    mocks: {
        repository: Mock<LocRequestRepository>,
        nodeApi: Mock<LogionNodeApi>,
    },
    mode: SetupVtpMode,
) {
    const { repository, nodeApi } = mocks;

    if(mode !== "NOT_VTP") {
        const maybeVerifiedIssuer = new Mock<Option<PalletLogionLocVerifiedIssuer>>();
        const verifiedIssuer = new Mock<PalletLogionLocVerifiedIssuer>();
        verifiedIssuer.setup(instance => instance.identityLoc).returns({ toString: () => new UUID(VTP_LOC_ID).toDecimalString() } as any);
        maybeVerifiedIssuer.setup(instance => instance.isSome).returns(true);
        maybeVerifiedIssuer.setup(instance => instance.unwrap()).returns(verifiedIssuer.object());
        nodeApi.setup(instance => instance.query.logionLoc.verifiedIssuersMap(ALICE, VTP_ADDRESS)).returnsAsync(maybeVerifiedIssuer.object());
    } else {
        const maybeVerifiedIssuer = new Mock<Option<PalletLogionLocVerifiedIssuer>>();
        maybeVerifiedIssuer.setup(instance => instance.isSome).returns(false);
        nodeApi.setup(instance => instance.query.logionLoc.verifiedIssuersMap(ALICE, VTP_ADDRESS)).returnsAsync(maybeVerifiedIssuer.object());
    }

    if(mode === 'SELECTED') {
        const vtpIdentityLocRequest = new Mock<LocRequestAggregateRoot>();
        vtpIdentityLocRequest.setup(instance => instance.id).returns(VTP_LOC_ID);
        vtpIdentityLocRequest.setup(instance => instance.getDescription()).returns({
            
        } as LocRequestDescription);
        repository.setup(instance => instance.findById(VTP_LOC_ID)).returnsAsync(vtpIdentityLocRequest.object());

        const vtpIdentityLoc = new Mock<PalletLogionLocLegalOfficerCase>();
        setupLoc(vtpIdentityLoc, "Identity", true);
        setupLocFetch(VTP_LOC_ID, vtpIdentityLoc, nodeApi);

        nodeApi.setup(instance => instance.query.logionLoc.verifiedIssuersByLocMap.entries(new UUID(REQUEST_ID).toDecimalString())).returnsAsync([
            [
                {
                    args: [
                        {},
                        {
                            toString: () => VTP_ADDRESS,
                        }
                    ]
                }
            ]
        ] as any);
    } else {
        nodeApi.setup(instance => instance.query.logionLoc.verifiedIssuersByLocMap.entries(new UUID(REQUEST_ID).toDecimalString())).returnsAsync([]);
    }
}

export const VTP_ADDRESS = "5FniDvPw22DMW1TLee9N8zBjzwKXaKB2DcvZZCQU5tjmv1kb";
export const VTP_LOC_ID = "501a5a20-2d16-4597-83aa-b96df7c8f194";

export function setUpVote(voteRepository: Mock<VoteRepository>, exists: boolean) {
    if (exists) {
        const vote = new Mock<VoteAggregateRoot>();
        vote.setup(instance => instance.voteId).returns(VOTE_ID);
        voteRepository.setup(instance => instance.findByLocId(REQUEST_ID)).returns(Promise.resolve(vote.object()));
    } else {
        voteRepository.setup(instance => instance.findByLocId(REQUEST_ID)).returns(Promise.resolve(null));
    }
}

export const VOTE_ID = "123";
