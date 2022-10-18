import { TestApp } from "@logion/rest-api-core";
import { writeFile } from 'fs/promises';
import { LocRequestController, UserPrivateData } from "../../../src/logion/controllers/locrequest.controller";
import { Container } from "inversify";
import request from "supertest";
import { ALICE } from "../../helpers/addresses";
import { Mock, It } from "moq.ts";
import {
    LocRequestRepository,
    LocRequestFactory,
    LocRequestAggregateRoot,
    NewLocRequestParameters,
    LocRequestStatus,
    FileDescription,
    LinkDescription,
    MetadataItemDescription,
    LocType,
    NewSofRequestParameters,
    FetchLocRequestsSpecification,
    IdentityLocType,
} from "../../../src/logion/model/locrequest.model";
import moment, { Moment } from "moment";
import { FileStorageService } from "../../../src/logion/services/file.storage.service";
import { NotificationService, Template } from "../../../src/logion/services/notification.service";
import { DirectoryService } from "../../../src/logion/services/directory.service";
import { notifiedLegalOfficer } from "../services/notification-test-data";
import { UUID } from "@logion/node-api/dist/UUID";
import { CollectionRepository, CollectionItemAggregateRoot } from "../../../src/logion/model/collection.model";
import { fileExists } from "../../helpers/filehelper";
import { LATEST_SEAL_VERSION, PersonalInfoSealService, Seal } from "../../../src/logion/services/seal.service";
import { UserIdentity } from "../../../src/logion/model/useridentity";
import { PersonalInfo } from "../../../src/logion/model/personalinfo.model";

type IdentityLocation = IdentityLocType | 'EmbeddedInLoc';

const userIdentities: Record<IdentityLocation, UserPrivateData> = {
    "Logion": {
        identityLocId: "2d0f662f-2fd1-4ad8-8019-1db74bfc5972",
        userIdentity: {
            firstName: "Felix",
            lastName: "the Cat",
            email: "felix@logion.network",
            phoneNumber: "+0101",
            company: false,
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
            company: false,
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
            company: false,
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

const testUserIdentity = userIdentities["Polkadot"].userIdentity!;

const SUBMITTER = "5DDGQertEH5qvKVXUmpT3KNGViCX582Qa2WWb8nGbkmkRHvw";
const SEAL: Seal = {
    hash: "0x5a60f0a435fa1c508ccc7a7dd0a0fe8f924ba911b815b10c9ef0ddea0c49052e",
    salt: "4bdc2a75-5363-4bc0-a71c-41a5781df07c",
    version: 0,
}

const testDataWithType = (locType: LocType) => {
    return {
        requesterAddress: "5CXLTF2PFBE89tTYsrofGPkSfGTdmW4ciw4vAfgcKhjggRgZ",
        description: "I want to open a case",
        locType
    }
};

const testData = testDataWithType("Transaction");

const logionIdentityLoc = {
    description: "Identity LOC",
    locType: "Identity",
    userIdentity: userIdentities["Logion"].userIdentity,
    userPostalAddress: userIdentities["Logion"].userPostalAddress,
}

const testDataWithLogionIdentity = {
    requesterIdentityLoc: userIdentities["Logion"].identityLocId,
    description: "I want to open a case",
    locType: "Transaction"
};

const testFile:FileDescription = {
    name: "test-file",
    nature: "file-nature",
    contentType: "application/pdf",
    hash: "0x9383cd5dfeb5870027088289c665c3bae2d339281840473f35311954e984dea9",
    oid: 123,
    submitter: SUBMITTER,
    addedOn: moment("2022-08-31T15:53:12.741Z")
}

const testLink:LinkDescription = {
    target: "507a00a1-7387-44b8-ac4d-fa57ccbf6da5",
    nature: "link-nature"
}

const testMetadataItem:MetadataItemDescription = {
    name: "test-data",
    value: "test-data-value",
    submitter: SUBMITTER,
}

const testDataWithUserIdentityWithType = (locType: LocType) => {
    const { userIdentity, userPostalAddress } = userIdentities["EmbeddedInLoc"];
    return {
        ...testDataWithType(locType),
        userIdentity,
        userPostalAddress,
        seal: {
            hash: SEAL.hash
        }
    }
};

const testDataWithUserIdentity = testDataWithUserIdentityWithType("Transaction")

const REJECT_REASON = "Illegal";
const REQUEST_ID = "3e67427a-d80f-41d7-9c86-75a63b8563a1"
const VOID_REASON = "Expired";
const DECISION_TIMESTAMP = "2022-08-31T16:01:15.652Z"

let notificationService: Mock<NotificationService>;
let collectionRepository: Mock<CollectionRepository>;

const { mockAuthenticationForUserOrLegalOfficer, mockAuthenticationWithCondition, setupApp } = TestApp;

describe('LocRequestController', () => {

    async function testLocRequestCreationWithEmbeddedUserIdentity(locType: LocType, expectedStatus: number, expectedErrorMessage?: string, hasPolkadotIdentityLoc: boolean = false) {
        const mock = mockAuthenticationForUserOrLegalOfficer(false);
        const app = setupApp(
            LocRequestController,
            container => mockModelForCreation(container, locType, hasPolkadotIdentityLoc),
            mock
        )
        const expectedUserPrivateData = userIdentities["EmbeddedInLoc"];
        await request(app)
            .post('/api/loc-request')
            .send(testDataWithUserIdentityWithType(locType))
            .expect(expectedStatus)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                if (expectedStatus === 200) {
                    expect(response.body.id).toBeDefined();
                    expect(response.body.status).toBe("REQUESTED");
                    expect(response.body.locType).toBe(locType);
                    checkPrivateData(response, expectedUserPrivateData);
                    expect(response.body.seal).toEqual(SEAL.hash)
                } else {
                    expect(response.body.errorMessage).toEqual(expectedErrorMessage);
                }
            });
    }

    function checkPrivateData(response: request.Response, expectedUserPrivateData: UserPrivateData) {
        expect(response.body.identityLoc).toEqual(expectedUserPrivateData.identityLocId);
        const userIdentity = response.body.userIdentity;
        expect(userIdentity).toEqual(expectedUserPrivateData.userIdentity);
        const userPostalAddress = response.body.userPostalAddress;
        expect(userPostalAddress).toEqual(expectedUserPrivateData.userPostalAddress);
    }

    it('fails to create a Transaction loc request with embedded user identity', async () => {
        await testLocRequestCreationWithEmbeddedUserIdentity("Transaction", 400, "Unable to find a valid (closed) identity LOC.")
    });

    it('fails to create a Collection loc request with embedded user identity', async () => {
        await testLocRequestCreationWithEmbeddedUserIdentity("Collection", 400, "Unable to find a valid (closed) identity LOC.")
    });

    it('succeeds to create a Polkadot Identity loc request', async () => {
        await testLocRequestCreationWithEmbeddedUserIdentity("Identity", 200)
    });

    it('fails to create twice the same Polkadot Identity loc request', async () => {
        await testLocRequestCreationWithEmbeddedUserIdentity("Identity", 400, "Only one Polkadot Identity LOC is allowed per Legal Officer.", true)
    });

    async function testOpenLocCreation(locType: LocType) {
        const mock = mockAuthenticationForUserOrLegalOfficer(true);
        const app = setupApp(
            LocRequestController,
            container => mockModelForCreation(container, locType, true),
            mock,
        )
        const expectedUserPrivateData = userIdentities["Polkadot"];
        await request(app)
            .post('/api/loc-request')
            .send(testDataWithType(locType))
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.id).toBeDefined();
                expect(response.body.status).toBe("OPEN");
                expect(response.body.locType).toBe(locType);
                checkPrivateData(response, expectedUserPrivateData);
            });
    }

    it('succeeds to create open Transaction loc with existing existing identity LOC', async () => {
        await testOpenLocCreation("Transaction")
    });

    it('succeeds to create open Collection loc with existing existing identity LOC', async () => {
        await testOpenLocCreation("Collection")
    });

    async function testOpenLocCreationWithEmbeddedUserIdentity(locType: LocType, expectedStatus: number, expectedErrorMessage?: string, hasPolkadotIdentityLoc: boolean = false) {
        const mock = mockAuthenticationForUserOrLegalOfficer(true);
        const app = setupApp(
            LocRequestController,
            container => mockModelForCreation(container, locType, hasPolkadotIdentityLoc),
            mock,
        )
        const expectedUserPrivateData = userIdentities["EmbeddedInLoc"];
        await request(app)
            .post('/api/loc-request')
            .send(testDataWithUserIdentityWithType(locType))
            .expect(expectedStatus)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                if (expectedStatus === 200) {
                    expect(response.body.id).toBeDefined();
                    expect(response.body.status).toBe("OPEN");
                    expect(response.body.locType).toBe(locType);
                    checkPrivateData(response, expectedUserPrivateData);
                } else {
                    expect(response.body.errorMessage).toEqual(expectedErrorMessage);
                }
            });
    }

    it('fails to create open Transaction loc with embedded user identity', async () => {
        await testOpenLocCreationWithEmbeddedUserIdentity("Transaction", 400, "Unable to find a valid (closed) identity LOC.")
    });

    it('fails to create open Collection loc with embedded user identity', async () => {
        await testOpenLocCreationWithEmbeddedUserIdentity("Collection", 400, "Unable to find a valid (closed) identity LOC.")
    });

    it('succeeds to create open Identity loc with embedded user identity', async () => {
        await testOpenLocCreationWithEmbeddedUserIdentity("Identity", 200)
    });

    it('fails to create twice the same open Identity loc with embedded user identity', async () => {
        await testOpenLocCreationWithEmbeddedUserIdentity("Identity", 400, "Only one Polkadot Identity LOC is allowed per Legal Officer.", true)
    });

    it('succeeds to create open loc with a Logion identity LOC', async () => {
        const mock = mockAuthenticationForUserOrLegalOfficer(true);
        const app = setupApp(
            LocRequestController,
            mockModelForCreationWithLogionIdentityLoc,
            mock,
        )
        const expectedUserPrivateData = userIdentities["Logion"];
        await request(app)
            .post('/api/loc-request')
            .send(testDataWithLogionIdentity)
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.id).toBeDefined();
                expect(response.body.status).toBe("OPEN");
                expect(response.body.locType).toBe("Transaction");
                expect(response.body.requesterAddress).toBeUndefined();
                expect(response.body.requesterIdentityLoc).toBe(expectedUserPrivateData.identityLocId);
                checkPrivateData(response, expectedUserPrivateData);
            });
    });

    async function testLocRequestCreation(locType: LocType) {
        const mock = mockAuthenticationForUserOrLegalOfficer(false);
        const app = setupApp(
            LocRequestController,
            container => mockModelForCreation(container, locType, true),
            mock,
        )
        const expectedUserPrivateData = userIdentities["Polkadot"];
        await request(app)
            .post('/api/loc-request')
            .send(testDataWithType(locType))
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.id).toBeDefined();
                expect(response.body.status).toBe("REQUESTED");
                expect(response.body.locType).toBe(locType);
                checkPrivateData(response, expectedUserPrivateData);
            });

        notificationService.verify(instance => instance.notify("alice@logion.network", "loc-requested", It.Is<any>(data => {
            return data.loc.locType === locType
        })))

    }

    it('succeeds to create Transaction loc request with existing identity LOC', async () => {
        await testLocRequestCreation("Transaction")
    });

    it('succeeds to create Collection loc request with existing identity LOC', async () => {
        await testLocRequestCreation("Collection")
    });

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
                expect(request1.requesterAddress).toBe(testData.requesterAddress);
                expect(request1.ownerAddress).toBe(ALICE);
                expect(request1.status).toBe("REJECTED");
                expect(request1.rejectReason).toBe(REJECT_REASON);
                const userIdentity = request1.userIdentity;
                expect(userIdentity).toEqual(expectedUserPrivateData.userIdentity)
                const userPostalAddress = request1.userPostalAddress;
                expect(userPostalAddress).toEqual(expectedUserPrivateData.userPostalAddress)
            });
    });

    it('fails to create loc request - authentication failure', async () => {
        const app = setupApp(
            LocRequestController,
            container => mockModelForCreation(container, "Transaction"),
            mockAuthenticationWithCondition(false),
        );
        await request(app)
            .post('/api/loc-request')
            .send(testDataWithType("Transaction"))
            .expect(401)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.id).toBeUndefined();
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

    it('rejects a requested loc', async () => {
        const app = setupApp(LocRequestController, mockModelForReject)
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
        const app = setupApp(LocRequestController, mockModelForAccept)
        await request(app)
            .post(`/api/loc-request/${ REQUEST_ID }/accept`)
            .expect(200)

        notificationService.verify(instance => instance.notify(testUserIdentity.email, "loc-accepted", It.Is<any>(data => {
            return data.loc.decision.decisionOn === DECISION_TIMESTAMP
        })))
    })

    it('adds file to loc', async () => {
        const app = setupApp(LocRequestController, mockModelForAddFile);
        const buffer = Buffer.from(SOME_DATA);
        await request(app)
            .post(`/api/loc-request/${ REQUEST_ID }/files`)
            .field({ nature: "some nature" })
            .attach('file', buffer, {
                filename: FILE_NAME,
                contentType: 'text/plain',
            })
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.hash).toBe(SOME_DATA_HASH);
            });
    })

    it('fails to add file to loc when neither owner nor requester', async () => {
        const mock = mockAuthenticationWithCondition(false);
        const app = setupApp(LocRequestController, mockModelForAddFile, mock);
        const buffer = Buffer.from(SOME_DATA);
        await request(app)
            .post(`/api/loc-request/${ REQUEST_ID }/files`)
            .field({ nature: "some nature" })
            .attach('file', buffer, {
                filename: FILE_NAME,
                contentType: 'text/plain',
            })
            .expect(401);
    })

    it('downloads existing file given its hash', async () => {
        const app = setupApp(LocRequestController, mockModelForDownloadFile);
        const filePath = "/tmp/download-" + REQUEST_ID + "-" + SOME_DATA_HASH;
        await writeFile(filePath, SOME_DATA);
        await request(app)
            .get(`/api/loc-request/${ REQUEST_ID }/files/${ SOME_DATA_HASH }`)
            .expect(200, SOME_DATA)
            .expect('Content-Type', /text\/plain/);
        let fileReallyExists = true;
        for(let i = 0; i < 10; ++i) {
            if(!await fileExists(filePath)) {
                fileReallyExists = false;
                break;
            }
        }
        if(fileReallyExists) {
            expect(true).toBe(false);
        }
    })

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

    async function testGet(app: ReturnType<typeof setupApp>, expectedUserPrivateData: UserPrivateData) {
        await request(app)
            .get(`/api/loc-request/${ REQUEST_ID }`)
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.id).toBe(REQUEST_ID);
                const file = response.body.files[0]
                expect(file.name).toBe(testFile.name)
                expect(file.nature).toBe(testFile.nature)
                expect(file.hash).toBe(testFile.hash)
                expect(file.addedOn).toBe(testFile.addedOn?.toISOString())
                expect(file.submitter).toBe(SUBMITTER)
                const link = response.body.links[0]
                expect(link.nature).toBe(testLink.nature)
                expect(link.target).toBe(testLink.target)
                expect(link.addedOn).toBe(testLink.addedOn?.toISOString())
                const metadataItem = response.body.metadata[0]
                expect(metadataItem.name).toBe(testMetadataItem.name)
                expect(metadataItem.value).toBe(testMetadataItem.value)
                expect(metadataItem.addedOn).toBe(testMetadataItem.addedOn?.toISOString())
                expect(metadataItem.submitter).toBe(SUBMITTER)
                checkPrivateData(response, expectedUserPrivateData);
            });
    }

    it('deletes a file', async () => {
        const app = setupApp(LocRequestController, mockModelForDeleteFile)
        await request(app)
            .delete(`/api/loc-request/${REQUEST_ID}/files/${SOME_DATA_HASH}`)
            .expect(200);
    });

    it('confirms a file', async () => {
        const app = setupApp(LocRequestController, mockModelForConfirmFile)
        await request(app)
            .put(`/api/loc-request/${REQUEST_ID}/files/${SOME_DATA_HASH}/confirm`)
            .expect(204);
    });

    it('adds a metadata item', async () => {
        const locRequest = mockRequestForMetadata();
        const app = setupApp(LocRequestController, (container) => mockModelForAllItems(container, locRequest))
        await request(app)
            .post(`/api/loc-request/${ REQUEST_ID }/metadata`)
            .send({ name: SOME_DATA_NAME, value: SOME_DATA_VALUE })
            .expect(204)
        locRequest.verify(instance => instance.addMetadataItem(
            It.Is<MetadataItemDescription>(item => item.name == SOME_DATA_NAME && item.value == SOME_DATA_VALUE)))
    })

    it('fails to adds a metadata item when neither owner nor requester', async () => {
        const locRequest = mockRequestForMetadata();
        const mock = mockAuthenticationWithCondition(false);
        const app = setupApp(LocRequestController, (container) => mockModelForAllItems(container, locRequest), mock);
        await request(app)
            .post(`/api/loc-request/${ REQUEST_ID }/metadata`)
            .send({ name: SOME_DATA_NAME, value: SOME_DATA_VALUE })
            .expect(401)
    })

    it('deletes a metadata item', async () => {
        const locRequest = mockRequestForMetadata();
        const app = setupApp(LocRequestController, (container) => mockModelForAllItems(container, locRequest))
        const dataName = encodeURIComponent(SOME_DATA_NAME)
        await request(app)
            .delete(`/api/loc-request/${ REQUEST_ID }/metadata/${ dataName }`)
            .expect(200)
        locRequest.verify(instance => instance.removeMetadataItem(ALICE, SOME_DATA_NAME))
    })

    it('confirms a metadata item', async () => {
        const locRequest = mockRequestForMetadata();
        const app = setupApp(LocRequestController, (container) => mockModelForAllItems(container, locRequest))
        const dataName = encodeURIComponent(SOME_DATA_NAME)
        await request(app)
            .put(`/api/loc-request/${ REQUEST_ID }/metadata/${ dataName }/confirm`)
            .expect(204)
        locRequest.verify(instance => instance.confirmMetadataItem(SOME_DATA_NAME))
    })


    it('adds a link', async () => {
        const locRequest = mockRequestForLink();
        const app = setupApp(LocRequestController, (container) => mockModelForAddLink(container, locRequest))
        await request(app)
            .post(`/api/loc-request/${ REQUEST_ID }/links`)
            .send({ target: SOME_LINK_TARGET, nature: SOME_LINK_NATURE })
            .expect(204)
        locRequest.verify(instance => instance.addLink(
            It.Is<LinkDescription>(item => item.target == SOME_LINK_TARGET && item.nature == SOME_LINK_NATURE)))
    })

    it('deletes a link', async () => {
        const locRequest = mockRequestForLink();
        const app = setupApp(LocRequestController, (container) => mockModelForAllItems(container, locRequest))
        await request(app)
            .delete(`/api/loc-request/${ REQUEST_ID }/links/${ SOME_LINK_TARGET }`)
            .expect(200)
        locRequest.verify(instance => instance.removeLink(ALICE, SOME_LINK_TARGET))
    })

    it('confirms a link', async () => {
        const locRequest = mockRequestForLink();
        const app = setupApp(LocRequestController, (container) => mockModelForAllItems(container, locRequest))
        await request(app)
            .put(`/api/loc-request/${ REQUEST_ID }/links/${ SOME_LINK_TARGET }/confirm`)
            .expect(204)
        locRequest.verify(instance => instance.confirmLink(SOME_LINK_TARGET))
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

    it('creates a SOF request for Transaction LOC', async () => {
        const factory = new Mock<LocRequestFactory>();
        const LOC_ID = new UUID("ebf12a7a-f25f-4830-bd91-d0a7051f641e");
        const app = setupApp(LocRequestController, container => mockModelForCreateSofRequest(container, factory, 'Transaction', LOC_ID))
        await request(app)
            .post(`/api/loc-request/sof`)
            .send({
                locId: LOC_ID.toString()
            })
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.id).toBe(REQUEST_ID);
                expect(response.body.status).toBe("REQUESTED");
            })
        factory.verify(instance => instance.newSofRequest(It.Is<NewSofRequestParameters>(param =>
                param.description.description === `Statement of Facts for LOC ${ LOC_ID.toDecimalString() }` &&
                param.nature === "Original LOC"))
        )
    })

    it('creates a SOF request for Collection LOC', async () => {
        const factory = new Mock<LocRequestFactory>();
        const LOC_ID = new UUID("ebf12a7a-f25f-4830-bd91-d0a7051f641e");
        const itemId = "0x6dec991b1b61b44550769ae3c4b7f54f7cd618391f32bab2bc4e3a96cbb2b198";
        const app = setupApp(LocRequestController, container => mockModelForCreateSofRequest(container, factory, 'Collection', LOC_ID, itemId))
        await request(app)
            .post(`/api/loc-request/sof`)
            .send({
                locId: LOC_ID.toString(),
                itemId: itemId
            })
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.id).toBe(REQUEST_ID);
                expect(response.body.status).toBe("REQUESTED");
            })
        factory.verify(instance => instance.newSofRequest(It.Is<NewSofRequestParameters>(param =>
            param.description.description === `Statement of Facts for LOC ${ LOC_ID.toDecimalString() } - ${ itemId }` &&
            param.nature === `Original LOC - Collection Item: ${ itemId }`))
        )
    })
})

function mockModelForReject(container: Container): void {
    const factory = new Mock<LocRequestFactory>();
    container.bind(LocRequestFactory).toConstantValue(factory.object());
    const request = mockRequest("REQUESTED", testData);
    request.setup(instance => instance.reject(It.Is<string>(reason => reason === REJECT_REASON), It.IsAny<Moment>()))
        .returns();
    request.setup(instance => instance.getDecision())
        .returns({ decisionOn: DECISION_TIMESTAMP, rejectReason: REJECT_REASON })
    const repository = new Mock<LocRequestRepository>();
    repository.setup(instance => instance.save(It.IsAny<LocRequestAggregateRoot>()))
        .returns(Promise.resolve());
    repository.setup(instance => instance.findById(It.Is<string>(id => id === REQUEST_ID)))
        .returns(Promise.resolve(request.object()));
    container.bind(LocRequestRepository).toConstantValue(repository.object());
    mockPolkadotIdentityLoc(repository, true);

    const fileStorageService = new Mock<FileStorageService>();
    container.bind(FileStorageService).toConstantValue(fileStorageService.object());
    mockOtherDependencies(container)
}

function mockModelForAccept(container: Container): void {
    const factory = new Mock<LocRequestFactory>();
    container.bind(LocRequestFactory).toConstantValue(factory.object());
    const request = mockRequest("REQUESTED", testData);
    request.setup(instance => instance.accept(It.Is<string>(It.IsAny<Moment>())))
        .returns();
    request.setup(instance => instance.getDecision())
        .returns({ decisionOn: DECISION_TIMESTAMP })
    const repository = new Mock<LocRequestRepository>();
    repository.setup(instance => instance.save(It.IsAny<LocRequestAggregateRoot>()))
        .returns(Promise.resolve());
    repository.setup(instance => instance.findById(It.Is<string>(id => id === REQUEST_ID)))
        .returns(Promise.resolve(request.object()));
    container.bind(LocRequestRepository).toConstantValue(repository.object());
    mockPolkadotIdentityLoc(repository, true);

    const fileStorageService = new Mock<FileStorageService>();
    container.bind(FileStorageService).toConstantValue(fileStorageService.object());
    mockOtherDependencies(container)
}

function mockModelForCreation(container: Container, locType: LocType, hasPolkadotIdentityLoc: boolean = false): void {

    const repository = new Mock<LocRequestRepository>();
    repository.setup(instance => instance.save)
        .returns(() => Promise.resolve());
    container.bind(LocRequestRepository).toConstantValue(repository.object());

    const factory = new Mock<LocRequestFactory>();
    const request = mockRequest("REQUESTED", hasPolkadotIdentityLoc ? testDataWithType(locType) : testDataWithUserIdentityWithType(locType))
    factory.setup(instance => instance.newLocRequest(It.Is<NewLocRequestParameters>(params =>
        params.description.requesterAddress == testData.requesterAddress &&
        params.description.ownerAddress == ALICE &&
        params.description.description == testData.description
    )))
        .returns(Promise.resolve(request.object()))
    const openLoc = mockRequest("OPEN", hasPolkadotIdentityLoc ? testDataWithType(locType) : testDataWithUserIdentityWithType(locType))
    factory.setup(instance => instance.newOpenLoc(It.Is<NewLocRequestParameters>(params =>
        params.description.requesterAddress == testData.requesterAddress &&
        params.description.ownerAddress == ALICE &&
        params.description.description == testData.description
    )))
        .returns(Promise.resolve(openLoc.object()))
    container.bind(LocRequestFactory).toConstantValue(factory.object());
    mockPolkadotIdentityLoc(repository, hasPolkadotIdentityLoc);

    const fileStorageService = new Mock<FileStorageService>();
    container.bind(FileStorageService).toConstantValue(fileStorageService.object());
    mockOtherDependencies(container)
}

function mockModelForCreationWithLogionIdentityLoc(container: Container): void {

    const repository = new Mock<LocRequestRepository>();
    repository.setup(instance => instance.save)
        .returns(() => Promise.resolve());
    container.bind(LocRequestRepository).toConstantValue(repository.object());

    mockLogionIdentityLoc(repository, true);
    mockPolkadotIdentityLoc(repository, false);

    const factory = new Mock<LocRequestFactory>();
    const request = mockRequest("OPEN", { ...testDataWithLogionIdentity, requesterIdentityLocId: testDataWithLogionIdentity.requesterIdentityLoc });
    factory.setup(instance => instance.newOpenLoc(It.Is<NewLocRequestParameters>(params =>
        params.description.requesterIdentityLoc === userIdentities["Logion"].identityLocId &&
        params.description.ownerAddress == ALICE
    )))
        .returns(Promise.resolve(request.object()))
    container.bind(LocRequestFactory).toConstantValue(factory.object());

    const fileStorageService = new Mock<FileStorageService>();
    container.bind(FileStorageService).toConstantValue(fileStorageService.object());
    mockOtherDependencies(container)
}

function mockLogionIdentityLoc(repository: Mock<LocRequestRepository>, exists: boolean) {
    const identityLocId = userIdentities["Logion"].identityLocId!;
    const identityLocRequest = exists ?
        mockRequestWithId(identityLocId, "Identity", "CLOSED", logionIdentityLoc).object() :
        null;
    repository.setup(instance => instance.findById(identityLocId))
        .returns(Promise.resolve(identityLocRequest))
}

function mockPolkadotIdentityLoc(repository: Mock<LocRequestRepository>, exists: boolean) {
    const { userIdentity, userPostalAddress } = userIdentities["Polkadot"]
    const identityLocs = exists ?
        [ mockRequestWithId(
            userIdentities["Polkadot"].identityLocId!,
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
}

function mockRequest(
    status: LocRequestStatus,
    data: any,
    files: FileDescription[] = [],
    metadataItems: MetadataItemDescription[] = [],
    links: LinkDescription[] = [],
): Mock<LocRequestAggregateRoot> {
    return mockRequestWithId(REQUEST_ID, undefined, status, data, files, metadataItems, links)
}

function mockRequestWithId(
    id: string,
    locType: LocType | undefined,
    status: LocRequestStatus,
    data: any,
    files: FileDescription[] = [],
    metadataItems: MetadataItemDescription[] = [],
    links: LinkDescription[] = [],
): Mock<LocRequestAggregateRoot> {
    const request = new Mock<LocRequestAggregateRoot>();
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
            ...data,
            createdOn: "2022-08-31T16:01:15.651Z",
            ownerAddress: ALICE
        });
    request.setup(instance => instance.getFiles()).returns(files);
    request.setup(instance => instance.getMetadataItems()).returns(metadataItems);
    request.setup(instance => instance.getLinks()).returns(links);
    request.setup(instance => instance.getVoidInfo()).returns(null);
    return request;
}

function mockModelForFetch(container: Container): void {
    const request = mockRequest("REJECTED", testDataWithUserIdentity)
    request.setup(instance => instance.rejectReason)
        .returns(REJECT_REASON);
    const requests: LocRequestAggregateRoot[] = [ request.object() ]

    const repository = new Mock<LocRequestRepository>();
    repository.setup(instance => instance.findBy)
        .returns(() => Promise.resolve(requests));
    container.bind(LocRequestRepository).toConstantValue(repository.object());

    const factory = new Mock<LocRequestFactory>();
    container.bind(LocRequestFactory).toConstantValue(factory.object());

    const fileStorageService = new Mock<FileStorageService>();
    container.bind(FileStorageService).toConstantValue(fileStorageService.object());
    mockOtherDependencies(container)
}

const SOME_DATA = 'some data';
const SOME_DATA_HASH = '0x1307990e6ba5ca145eb35e99182a9bec46531bc54ddf656a602c780fa0240dee';
const FILE_NAME = "'a-file.pdf'";

function mockModelForAddFile(container: Container): void {
    const factory = new Mock<LocRequestFactory>();
    container.bind(LocRequestFactory).toConstantValue(factory.object());

    const repository = new Mock<LocRequestRepository>();
    repository.setup(instance => instance.save(It.IsAny<LocRequestAggregateRoot>()))
        .returns(Promise.resolve());

    const request = mockRequest("OPEN", testData);
    request.setup(instance => instance.hasFile(SOME_DATA_HASH)).returns(false);
    request.setup(instance => instance.addFile).returns(() => {});

    repository.setup(instance => instance.findById(It.Is<string>(id => id === REQUEST_ID)))
        .returns(Promise.resolve(request.object()));
    repository.setup(instance => instance.save(request.object()))
        .returns(Promise.resolve());
    container.bind(LocRequestRepository).toConstantValue(repository.object());

    const fileStorageService = new Mock<FileStorageService>();
    fileStorageService.setup(instance => instance.importFile(It.IsAny<string>()))
        .returns(Promise.resolve("cid-42"));
    container.bind(FileStorageService).toConstantValue(fileStorageService.object());
    mockOtherDependencies(container)
}

function mockModelForDownloadFile(container: Container): void {
    const factory = new Mock<LocRequestFactory>();
    container.bind(LocRequestFactory).toConstantValue(factory.object());

    const repository = new Mock<LocRequestRepository>();
    repository.setup(instance => instance.save(It.IsAny<LocRequestAggregateRoot>()))
        .returns(Promise.resolve());
    const request = mockRequest("OPEN", testData);
    const hash = SOME_DATA_HASH;
    request.setup(instance => instance.getFile(hash)).returns(SOME_FILE);
    repository.setup(instance => instance.findById(It.Is<string>(id => id === REQUEST_ID)))
        .returns(Promise.resolve(request.object()));
    container.bind(LocRequestRepository).toConstantValue(repository.object());

    const fileStorageService = new Mock<FileStorageService>();
    const filePath = "/tmp/download-" + REQUEST_ID + "-" + hash;
    fileStorageService.setup(instance => instance.exportFile({ oid: SOME_OID }, filePath))
        .returns(Promise.resolve());
    container.bind(FileStorageService).toConstantValue(fileStorageService.object());
    mockOtherDependencies(container)
}

const SOME_OID = 123456;

const SOME_FILE = {
    name: "file-name",
    contentType: "text/plain",
    hash: SOME_DATA_HASH,
    oid: SOME_OID,
    nature: "file-nature",
    submitter: SUBMITTER
};

function mockModelForGetSingle(container: Container, locType: LocType, identityLocation: IdentityLocation): void {
    const data =
        identityLocation === "EmbeddedInLoc" ?
            testDataWithUserIdentityWithType(locType) :
            identityLocation === "Polkadot" ? testDataWithType(locType) :
                testDataWithLogionIdentity;

    const request = mockRequest("OPEN",
        data,
        [ testFile ],
        [ testMetadataItem ],
        [ testLink ],
    );

    const repository = new Mock<LocRequestRepository>();
    repository.setup(instance => instance.findById(REQUEST_ID))
        .returns(Promise.resolve(request.object()));
    container.bind(LocRequestRepository).toConstantValue(repository.object());

    const factory = new Mock<LocRequestFactory>();
    container.bind(LocRequestFactory).toConstantValue(factory.object());
    mockPolkadotIdentityLoc(repository, identityLocation === "Polkadot");
    mockLogionIdentityLoc(repository, identityLocation === "Logion");

    const fileStorageService = new Mock<FileStorageService>();
    container.bind(FileStorageService).toConstantValue(fileStorageService.object());
    mockOtherDependencies(container)
}

function mockModelForDeleteFile(container: Container) {
    const request = mockRequest("OPEN", testData);
    request.setup(instance => instance.removeFile(ALICE, SOME_DATA_HASH)).returns(SOME_FILE);

    const repository = new Mock<LocRequestRepository>();
    repository.setup(instance => instance.findById(REQUEST_ID))
        .returns(Promise.resolve(request.object()));
    repository.setup(instance => instance.save(request.object()))
        .returns(Promise.resolve());
    container.bind(LocRequestRepository).toConstantValue(repository.object());

    const factory = new Mock<LocRequestFactory>();
    container.bind(LocRequestFactory).toConstantValue(factory.object());
    mockPolkadotIdentityLoc(repository, false);

    const fileStorageService = new Mock<FileStorageService>();
    fileStorageService.setup(instance => instance.deleteFile({ oid: SOME_OID })).returns(Promise.resolve());
    container.bind(FileStorageService).toConstantValue(fileStorageService.object());
    mockOtherDependencies(container)
}

function mockModelForConfirmFile(container: Container) {
    const request = mockRequest("OPEN", testData);
    request.setup(instance => instance.confirmFile(SOME_DATA_HASH)).returns(undefined);

    const repository = new Mock<LocRequestRepository>();
    repository.setup(instance => instance.findById(REQUEST_ID))
        .returns(Promise.resolve(request.object()));
    repository.setup(instance => instance.save(request.object()))
        .returns(Promise.resolve());
    container.bind(LocRequestRepository).toConstantValue(repository.object());

    const factory = new Mock<LocRequestFactory>();
    container.bind(LocRequestFactory).toConstantValue(factory.object());
    mockPolkadotIdentityLoc(repository, false);

    const fileStorageService = new Mock<FileStorageService>();
    container.bind(FileStorageService).toConstantValue(fileStorageService.object());
    mockOtherDependencies(container)
}

const SOME_DATA_NAME = "data name with exotic char !é\"/&'"
const SOME_DATA_VALUE = "data value with exotic char !é\"/&'"

function mockRequestForMetadata(): Mock<LocRequestAggregateRoot> {
    const request = mockRequest("OPEN", testData);
    request.setup(instance => instance.removeMetadataItem(ALICE, SOME_DATA_NAME))
        .returns()
    request.setup(instance => instance.confirmMetadataItem(SOME_DATA_NAME))
        .returns()
    request.setup(instance => instance.addMetadataItem({
        name: SOME_DATA_NAME,
        value: SOME_DATA_VALUE,
        submitter: SUBMITTER
    }))
        .returns()
    return request;
}

const SOME_LINK_TARGET = '35bac9a0-1516-4f8d-ae9e-9b14abe87e25'
const SOME_LINK_NATURE = 'link_nature'

function mockRequestForLink(): Mock<LocRequestAggregateRoot> {
    const request = mockRequest("OPEN", testData);
    request.setup(instance => instance.removeLink(ALICE, SOME_LINK_TARGET))
        .returns()
    request.setup(instance => instance.confirmLink(SOME_LINK_TARGET))
        .returns()
    request.setup(instance => instance.addLink({ target: SOME_LINK_TARGET, nature: SOME_LINK_NATURE}))
        .returns()
    return request;
}

function mockModelForAllItems(container: Container, request: Mock<LocRequestAggregateRoot>) {
    const repository = new Mock<LocRequestRepository>();
    repository.setup(instance => instance.findById(REQUEST_ID))
        .returns(Promise.resolve(request.object()));
    repository.setup(instance => instance.save(request.object()))
        .returns(Promise.resolve());
    container.bind(LocRequestRepository).toConstantValue(repository.object());

    const factory = new Mock<LocRequestFactory>();
    container.bind(LocRequestFactory).toConstantValue(factory.object());
    mockPolkadotIdentityLoc(repository, false);

    const fileStorageService = new Mock<FileStorageService>();
    container.bind(FileStorageService).toConstantValue(fileStorageService.object());
    mockOtherDependencies(container)
}

function mockModelForAddLink(container: Container, request: Mock<LocRequestAggregateRoot>) {
    const repository = new Mock<LocRequestRepository>();
    repository.setup(instance => instance.findById(REQUEST_ID))
        .returns(Promise.resolve(request.object()));
    repository.setup(instance => instance.save(request.object()))
        .returns(Promise.resolve());
    const linkTargetRequest = mockRequest("OPEN", testData)
    linkTargetRequest.setup(instance => instance.id).returns(SOME_LINK_TARGET)
    repository.setup(instance => instance.findById(SOME_LINK_TARGET))
        .returns(Promise.resolve(linkTargetRequest.object()))

    container.bind(LocRequestRepository).toConstantValue(repository.object());

    const factory = new Mock<LocRequestFactory>();
    container.bind(LocRequestFactory).toConstantValue(factory.object());
    mockPolkadotIdentityLoc(repository, false);

    const fileStorageService = new Mock<FileStorageService>();
    container.bind(FileStorageService).toConstantValue(fileStorageService.object());
    mockOtherDependencies(container)
}

function mockModelForCreateSofRequest(container: Container, factory: Mock<LocRequestFactory>, locType: LocType, locId: UUID, itemId?: string) {
    const repository = new Mock<LocRequestRepository>();
    const targetLoc = mockRequest("CLOSED", testDataWithUserIdentityWithType(locType))
    targetLoc.setup(instance => instance.id).returns(locId.toString())
    targetLoc.setup(instance => instance.locType).returns(locType)
    repository.setup(instance => instance.findById(locId.toString()))
        .returns(Promise.resolve(targetLoc.object()))

    container.bind(LocRequestRepository).toConstantValue(repository.object());

    const request = mockRequest("REQUESTED", testDataWithUserIdentityWithType(locType))
    request.setup(instance => instance.id).returns(REQUEST_ID)
    repository.setup(instance => instance.save(request.object()))
        .returns(Promise.resolve())
    factory.setup(instance => instance.newSofRequest(It.IsAny<NewSofRequestParameters>()))
        .returns(Promise.resolve(request.object()))
    container.bind(LocRequestFactory).toConstantValue(factory.object());
    mockPolkadotIdentityLoc(repository, false);

    const fileStorageService = new Mock<FileStorageService>();
    container.bind(FileStorageService).toConstantValue(fileStorageService.object());
    mockOtherDependencies(container)

    if (locType === 'Collection' && itemId) {
        const collectionItem = new Mock<CollectionItemAggregateRoot>()
        collectionItem.setup(instance => instance.itemId)
            .returns(itemId)
        collectionRepository.setup(instance => instance.findBy(locId.toString(), itemId))
            .returns(Promise.resolve(collectionItem.object()))
    }
}

function mockModelForPreClose(container: Container, locType: LocType, userIdentity?: UserIdentity) {
    const data = {
        ...testDataWithType(locType),
        userIdentity
    };
    const request = mockRequest("OPEN", data);
    request.setup(instance => instance.locType).returns(locType);
    request.setup(instance => instance.preClose()).returns(undefined);

    const repository = new Mock<LocRequestRepository>();
    repository.setup(instance => instance.findById(REQUEST_ID))
        .returns(Promise.resolve(request.object()));
    repository.setup(instance => instance.save(request.object()))
        .returns(Promise.resolve());
    container.bind(LocRequestRepository).toConstantValue(repository.object());

    const factory = new Mock<LocRequestFactory>();
    container.bind(LocRequestFactory).toConstantValue(factory.object());
    mockPolkadotIdentityLoc(repository, false);

    const fileStorageService = new Mock<FileStorageService>();
    container.bind(FileStorageService).toConstantValue(fileStorageService.object());
    mockOtherDependencies(container)
}

function mockModelForPreVoid(container: Container) {
    const request = mockRequest("OPEN", testData);
    request.setup(instance => instance.preVoid(VOID_REASON)).returns(undefined);

    const repository = new Mock<LocRequestRepository>();
    repository.setup(instance => instance.findById(REQUEST_ID))
        .returns(Promise.resolve(request.object()));
    repository.setup(instance => instance.save(request.object()))
        .returns(Promise.resolve());
    container.bind(LocRequestRepository).toConstantValue(repository.object());

    const factory = new Mock<LocRequestFactory>();
    container.bind(LocRequestFactory).toConstantValue(factory.object());
    mockPolkadotIdentityLoc(repository, false);

    const fileStorageService = new Mock<FileStorageService>();
    container.bind(FileStorageService).toConstantValue(fileStorageService.object());
    mockOtherDependencies(container)
}

function mockOtherDependencies(container: Container) {
    notificationService = new Mock<NotificationService>();
    notificationService
        .setup(instance => instance.notify(It.IsAny<string>(), It.IsAny<Template>(), It.IsAny<any>()))
        .returns(Promise.resolve())
    container.bind(NotificationService).toConstantValue(notificationService.object())

    const directoryService = new Mock<DirectoryService>();
    directoryService
        .setup(instance => instance.get(It.IsAny<string>()))
        .returns(Promise.resolve(notifiedLegalOfficer(ALICE)))
    container.bind(DirectoryService).toConstantValue(directoryService.object())

    collectionRepository = new Mock<CollectionRepository>();
    container.bind(CollectionRepository).toConstantValue(collectionRepository.object())

    const sealService = new Mock<PersonalInfoSealService>();
    sealService
        .setup(instance => instance.seal(It.IsAny<PersonalInfo>(), LATEST_SEAL_VERSION))
        .returns(SEAL);
    container.bind(PersonalInfoSealService).toConstantValue(sealService.object());
}

