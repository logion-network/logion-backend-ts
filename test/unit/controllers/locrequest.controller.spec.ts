import { setupApp } from "../../helpers/testapp";
import { readFile, writeFile } from 'fs/promises';
import { LocRequestController } from "../../../src/logion/controllers/locrequest.controller";
import { Container } from "inversify";
import request, { Response } from "supertest";
import { ALICE } from "../../../src/logion/model/addresses.model";
import { Mock, It } from "moq.ts";
import {
    LocRequestRepository,
    LocRequestFactory,
    LocRequestAggregateRoot,
    NewLocRequestParameters,
    LocRequestStatus,
} from "../../../src/logion/model/locrequest.model";
import moment, { Moment } from "moment";
import {
    ProtectionRequestRepository,
    ProtectionRequestAggregateRoot
} from "../../../src/logion/model/protectionrequest.model";
import { FileDbService } from "../../../src/logion/services/filedb.service";

const testUserIdentity = {
    firstName: "Scott",
    lastName: "Tiger",
    email: "scott.tiger@logion.network",
    phoneNumber: "+6789"
}

const testData = {
    requesterAddress: "5CXLTF2PFBE89tTYsrofGPkSfGTdmW4ciw4vAfgcKhjggRgZ",
    ownerAddress: ALICE,
    description: "I want to open a case"
};

const testDataWithUserIdentity = {
    ...testData,
    userIdentity: {
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@logion.network",
        phoneNumber: "+1234"
    }
};

const REJECT_REASON = "Illegal";
const REQUEST_ID = "3e67427a-d80f-41d7-9c86-75a63b8563a1"

describe('LocRequestController', () => {

    it('succeeds to create loc request with embedded user identity', async () => {
        const app = setupApp(
            LocRequestController,
            mockModelForCreation,
            true,
            { address: testData.requesterAddress, legalOfficer: false }
        )
        await request(app)
            .post('/api/loc-request')
            .send(testDataWithUserIdentity)
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.id).toBeDefined();
                expect(response.body.status).toBe("REQUESTED");
                const userIdentity = response.body.userIdentity;
                expect(userIdentity.firstName).toBe("John");
                expect(userIdentity.lastName).toBe("Doe");
                expect(userIdentity.email).toBe("john.doe@logion.network");
                expect(userIdentity.phoneNumber).toBe("+1234");
            });
    });

    it('succeeds to create open loc with existing protection request', async () => {
        const app = setupApp(
            LocRequestController,
            container => mockModelForCreation(container, true),
            true,
            { address: testData.ownerAddress, legalOfficer: true }
        )
        await request(app)
            .post('/api/loc-request')
            .send(testData)
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.id).toBeDefined();
                expect(response.body.status).toBe("OPEN");
                const userIdentity = response.body.userIdentity;
                expect(userIdentity.firstName).toBe("Scott");
                expect(userIdentity.lastName).toBe("Tiger");
                expect(userIdentity.email).toBe("scott.tiger@logion.network");
                expect(userIdentity.phoneNumber).toBe("+6789");
            });
    });

    it('succeeds to create open loc with embedded user identity', async () => {
        const app = setupApp(
            LocRequestController,
            mockModelForCreation,
            true,
            { address: testData.ownerAddress, legalOfficer: true }
        )
        await request(app)
            .post('/api/loc-request')
            .send(testDataWithUserIdentity)
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.id).toBeDefined();
                expect(response.body.status).toBe("OPEN");
                const userIdentity = response.body.userIdentity;
                expect(userIdentity.firstName).toBe("John");
                expect(userIdentity.lastName).toBe("Doe");
                expect(userIdentity.email).toBe("john.doe@logion.network");
                expect(userIdentity.phoneNumber).toBe("+1234");
            });
    });

    it('succeeds to create loc request with existing protection request', async () => {
        const app = setupApp(
            LocRequestController,
            container => mockModelForCreation(container, true),
            true,
            { address: testData.requesterAddress, legalOfficer: false }
        )
        await request(app)
            .post('/api/loc-request')
            .send(testData)
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.id).toBeDefined();
                expect(response.body.status).toBe("REQUESTED");
                const userIdentity = response.body.userIdentity;
                expect(userIdentity.firstName).toBe("Scott");
                expect(userIdentity.lastName).toBe("Tiger");
                expect(userIdentity.email).toBe("scott.tiger@logion.network");
                expect(userIdentity.phoneNumber).toBe("+6789");
            });
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
                checkResponse(response);
                const userIdentity = response.body.requests[0].userIdentity;
                expect(userIdentity.firstName).toBe("John");
                expect(userIdentity.lastName).toBe("Doe");
                expect(userIdentity.email).toBe("john.doe@logion.network");
                expect(userIdentity.phoneNumber).toBe("+1234");
            });
    });

    it('succeeds to fetch loc requests with existing protection request', async () => {
        const app = setupApp(LocRequestController, container => mockModelForFetch(container, true))
        await request(app)
            .put('/api/loc-request')
            .send({
                requesterAddress: testData.requesterAddress,
                statuses: [ "OPEN", "REJECTED" ]
            })
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                checkResponse(response);
                const userIdentity = response.body.requests[0].userIdentity;
                expect(userIdentity.firstName).toBe("Scott");
                expect(userIdentity.lastName).toBe("Tiger");
                expect(userIdentity.email).toBe("scott.tiger@logion.network");
                expect(userIdentity.phoneNumber).toBe("+6789");
            });
    });

    it('fails to create loc request - authentication failure', async () => {
        const app = setupApp(LocRequestController, mockModelForCreation, false)
        await request(app)
            .post('/api/loc-request')
            .send(testData)
            .expect(401)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.id).toBeUndefined();
            });
    });

    function checkResponse(response: Response) {
        expect(response.body.requests.length).toBe(1);
        expect(response.body.requests[0].id).toBe(REQUEST_ID)
        expect(response.body.requests[0].requesterAddress).toBe(testData.requesterAddress)
        expect(response.body.requests[0].ownerAddress).toBe(testData.ownerAddress)
        expect(response.body.requests[0].status).toBe("REJECTED")
        expect(response.body.requests[0].rejectReason).toBe(REJECT_REASON)
    }

    it('fails to fetch loc requests - authentication failure', async () => {
        const app = setupApp(LocRequestController, mockModelForFetch, false)
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
    })

    it('accepts a requested loc', async () => {
        const app = setupApp(LocRequestController, mockModelForAccept)
        await request(app)
            .post(`/api/loc-request/${ REQUEST_ID }/accept`)
            .expect(200)
    })

    it('adds file to loc', async () => {
        const app = setupApp(LocRequestController, mockModelForAddFile);
        const buffer = Buffer.from(SOME_DATA);
        await request(app)
            .post(`/api/loc-request/${ REQUEST_ID }/files`)
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

    it('succeeds to get single loc request', async () => {
        const app = setupApp(LocRequestController, mockModelForGetSingle)
        await request(app)
            .get(`/api/loc-request/${REQUEST_ID}`)
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.id).toBe(REQUEST_ID);
            });
    });

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
})

function mockModelForReject(container: Container): void {
    const factory = new Mock<LocRequestFactory>();
    container.bind(LocRequestFactory).toConstantValue(factory.object());
    const request = mockRequest("REQUESTED", testData);
    request.setup(instance => instance.reject(It.Is<string>(reason => reason === REJECT_REASON), It.IsAny<Moment>()))
        .returns();
    const repository = new Mock<LocRequestRepository>();
    repository.setup(instance => instance.save(It.IsAny<LocRequestAggregateRoot>()))
        .returns(Promise.resolve());
    repository.setup(instance => instance.findById(It.Is<string>(id => id === REQUEST_ID)))
        .returns(Promise.resolve(request.object()));
    container.bind(LocRequestRepository).toConstantValue(repository.object());
    const protectionRepository = new Mock<ProtectionRequestRepository>();
    container.bind(ProtectionRequestRepository).toConstantValue(protectionRepository.object());

    const fileDbService = new Mock<FileDbService>();
    container.bind(FileDbService).toConstantValue(fileDbService.object());
}

function mockModelForAccept(container: Container): void {
    const factory = new Mock<LocRequestFactory>();
    container.bind(LocRequestFactory).toConstantValue(factory.object());
    const request = mockRequest("REQUESTED", testData);
    request.setup(instance => instance.accept(It.Is<string>(It.IsAny<Moment>())))
        .returns();
    const repository = new Mock<LocRequestRepository>();
    repository.setup(instance => instance.save(It.IsAny<LocRequestAggregateRoot>()))
        .returns(Promise.resolve());
    repository.setup(instance => instance.findById(It.Is<string>(id => id === REQUEST_ID)))
        .returns(Promise.resolve(request.object()));
    container.bind(LocRequestRepository).toConstantValue(repository.object());
    const protectionRepository = new Mock<ProtectionRequestRepository>();
    container.bind(ProtectionRequestRepository).toConstantValue(protectionRepository.object());

    const fileDbService = new Mock<FileDbService>();
    container.bind(FileDbService).toConstantValue(fileDbService.object());
}

function mockModelForCreation(container: Container, hasProtection: boolean = false): void {

    const repository = new Mock<LocRequestRepository>();
    repository.setup(instance => instance.save)
        .returns(() => Promise.resolve());
    container.bind(LocRequestRepository).toConstantValue(repository.object());

    const factory = new Mock<LocRequestFactory>();
    const request = mockRequest("REQUESTED", hasProtection ? testData : testDataWithUserIdentity)
    factory.setup(instance => instance.newLocRequest(It.Is<NewLocRequestParameters>(params =>
        params.description.requesterAddress == testData.requesterAddress &&
        params.description.ownerAddress == testData.ownerAddress &&
        params.description.description == testData.description
    )))
        .returns(request.object())
    const openLoc = mockRequest("OPEN", hasProtection ? testData : testDataWithUserIdentity)
    factory.setup(instance => instance.newOpenLoc(It.Is<NewLocRequestParameters>(params =>
        params.description.requesterAddress == testData.requesterAddress &&
        params.description.ownerAddress == testData.ownerAddress &&
        params.description.description == testData.description
    )))
        .returns(openLoc.object())
    container.bind(LocRequestFactory).toConstantValue(factory.object());
    container.bind(ProtectionRequestRepository).toConstantValue(mockProtectionRepository(hasProtection));

    const fileDbService = new Mock<FileDbService>();
    container.bind(FileDbService).toConstantValue(fileDbService.object());
}

function mockProtectionRepository(hasProtection: boolean): ProtectionRequestRepository {
    const protectionRepository = new Mock<ProtectionRequestRepository>();
    if (hasProtection) {
        const protection = new Mock<ProtectionRequestAggregateRoot>()
        protection.setup(instance => instance.getDescription()).returns({
            userIdentity: testUserIdentity,
            userPostalAddress: {
                line1: "",
                line2: "",
                postalCode: "",
                city: "",
                country: "",
            },
            isRecovery: false,
            createdOn: "",
            requesterAddress: "5CSYdyGLF84KKvieonBoANeqPiUXZBn8CbnJFmpHiXzcG5Ft",
            addressToRecover: null
        })
        protectionRepository.setup(instance => instance.findBy(It.IsAny()))
            .returns(Promise.resolve([ protection.object() ]))
    } else {
        protectionRepository.setup(instance => instance.findBy(It.IsAny()))
            .returns(Promise.resolve([]))
    }
    return protectionRepository.object();
}

function mockRequest(status: LocRequestStatus, data: any): Mock<LocRequestAggregateRoot> {
    const request = new Mock<LocRequestAggregateRoot>();
    request.setup(instance => instance.status)
        .returns(status);
    request.setup(instance => instance.id)
        .returns(REQUEST_ID);
    request.setup(instance => instance.getDescription())
        .returns({
            ...data,
            createdOn: moment().toISOString()
        });
    request.setup(instance => instance.getFiles()).returns([]);
    request.setup(instance => instance.getMetadataItems()).returns([]);
    return request;
}

function mockModelForFetch(container: Container, hasProtection: boolean = false): void {
    const request = mockRequest("REJECTED", hasProtection ? testData : testDataWithUserIdentity)
    request.setup(instance => instance.rejectReason)
        .returns(REJECT_REASON);
    const requests: LocRequestAggregateRoot[] = [ request.object() ]

    const repository = new Mock<LocRequestRepository>();
    repository.setup(instance => instance.findBy)
        .returns(() => Promise.resolve(requests));
    container.bind(LocRequestRepository).toConstantValue(repository.object());

    const factory = new Mock<LocRequestFactory>();
    container.bind(LocRequestFactory).toConstantValue(factory.object());
    container.bind(ProtectionRequestRepository).toConstantValue(mockProtectionRepository(hasProtection));

    const fileDbService = new Mock<FileDbService>();
    container.bind(FileDbService).toConstantValue(fileDbService.object());
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
    request.setup(instance => instance.addFile).returns(() => {});
    repository.setup(instance => instance.findById(It.Is<string>(id => id === REQUEST_ID)))
        .returns(Promise.resolve(request.object()));
    repository.setup(instance => instance.save(request.object()))
        .returns(Promise.resolve());
    container.bind(LocRequestRepository).toConstantValue(repository.object());

    const protectionRepository = new Mock<ProtectionRequestRepository>();
    container.bind(ProtectionRequestRepository).toConstantValue(protectionRepository.object());

    const fileDbService = new Mock<FileDbService>();
    fileDbService.setup(instance => instance.importFile(It.IsAny<string>(), SOME_DATA_HASH))
        .returns(Promise.resolve(42));
    container.bind(FileDbService).toConstantValue(fileDbService.object());
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

    const protectionRepository = new Mock<ProtectionRequestRepository>();
    container.bind(ProtectionRequestRepository).toConstantValue(protectionRepository.object());

    const fileDbService = new Mock<FileDbService>();
    const filePath = "/tmp/download-" + REQUEST_ID + "-" + hash;
    fileDbService.setup(instance => instance.exportFile(SOME_OID, filePath))
        .returns(Promise.resolve());
    container.bind(FileDbService).toConstantValue(fileDbService.object());
}

const SOME_OID = 123456;

const SOME_FILE = {
    name: "file-name",
    contentType: "text/plain",
    hash: SOME_DATA_HASH,
    oid: SOME_OID
};

async function fileExists(filePath: string): Promise<boolean> {
    try {
        await readFile(filePath);
        return true;
    } catch {
        return false;
    }
}

function mockModelForGetSingle(container: Container): void {
    const request = mockRequest("OPEN", testData);

    const repository = new Mock<LocRequestRepository>();
    repository.setup(instance => instance.findById(REQUEST_ID))
        .returns(Promise.resolve(request.object()));
    container.bind(LocRequestRepository).toConstantValue(repository.object());

    const factory = new Mock<LocRequestFactory>();
    container.bind(LocRequestFactory).toConstantValue(factory.object());
    container.bind(ProtectionRequestRepository).toConstantValue(mockProtectionRepository(false));

    const fileDbService = new Mock<FileDbService>();
    container.bind(FileDbService).toConstantValue(fileDbService.object());
}

function mockModelForDeleteFile(container: Container) {
    const request = mockRequest("OPEN", testData);
    request.setup(instance => instance.removeFile(SOME_DATA_HASH)).returns(SOME_FILE);

    const repository = new Mock<LocRequestRepository>();
    repository.setup(instance => instance.findById(REQUEST_ID))
        .returns(Promise.resolve(request.object()));
    repository.setup(instance => instance.save(request.object()))
        .returns(Promise.resolve());
    container.bind(LocRequestRepository).toConstantValue(repository.object());

    const factory = new Mock<LocRequestFactory>();
    container.bind(LocRequestFactory).toConstantValue(factory.object());
    container.bind(ProtectionRequestRepository).toConstantValue(mockProtectionRepository(false));

    const fileDbService = new Mock<FileDbService>();
    fileDbService.setup(instance => instance.deleteFile(SOME_OID)).returns(Promise.resolve());
    container.bind(FileDbService).toConstantValue(fileDbService.object());
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
    container.bind(ProtectionRequestRepository).toConstantValue(mockProtectionRepository(false));

    const fileDbService = new Mock<FileDbService>();
    container.bind(FileDbService).toConstantValue(fileDbService.object());
}
