import { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosResponseHeaders, CreateAxiosDefaults } from "axios";
import { It, Mock, PlayTimes } from "moq.ts";
import { LocRequestAggregateRoot, LocRequestDescription, LocRequestRepository, FileDescription } from "src/logion/model/locrequest.model.js";
import { AxiosFactory } from "src/logion/services/axiosfactory.service.js";
import { FileStorageService } from "src/logion/services/file.storage.service.js";
import { LocRequestService } from "src/logion/services/locrequest.service.js";
import { ALICE } from "../../../helpers/addresses.js";
import { DisabledIdenfyService, EnabledIdenfyService } from "../../../../src/logion/services/idenfy/idenfy.service.js";
import { IdenfyVerificationSession } from "../../../../src/logion/services/idenfy/idenfy.types.js";
import { NonTransactionalLocRequestService } from "../../../../src/logion/services/locrequest.service.js";
import { Readable } from "stream";

describe("DisabledIdenfyService", () => {

    it("throws on session creation", async () => {
        const service = new DisabledIdenfyService();
        await expectAsync(service.createVerificationSession()).toBeRejectedWithError(Error, "iDenfy integration is disabled");
    });

    it("throws on callback", async () => {
        const service = new DisabledIdenfyService();
        await expectAsync(service.callback()).toBeRejectedWithError(Error, "iDenfy integration is disabled");
    });
});

describe("EnabledIdenfyService", () => {

    beforeEach(setupProcessEnv)
    afterEach(tearDownProcessEnv)

    it("creates verification session", async () => {
        const { locRequest, idenfyService, authenticatedAxios, locRequestRepository } = mockEnabledIdenfyService();
        const session: IdenfyVerificationSession = {
            authToken: "pgYQX0z2T8mtcpNj9I20uWVCLKNuG0vgr12f0wAC",
            scanRef: IDENFY_SCAN_REF,
        };
        authenticatedAxios.setup(instance => instance.post("/token", It.Is<any>(
            data => data.clientId === REQUEST_ID
            && data.firstName === "John"
            && data.lastName === "Doe"
            && data.successUrl === `${ BASE_URL }/user/idenfy&result=success&locId=${ REQUEST_ID }`
            && data.errorUrl === `${ BASE_URL }/user/idenfy&result=error&locId=${ REQUEST_ID }`
            && data.unverifiedUrl === `${ BASE_URL }/user/idenfy&result=unverified&locId=${ REQUEST_ID }`
            && data.callbackUrl === `${ BASE_URL }/api/idenfy/callback/${ IDENFY_SECRET }`
        ))).returnsAsync({
            data: session,
        } as AxiosResponse);

        const redirect = await idenfyService.createVerificationSession(locRequest.object());

        expect(redirect.url).toBe(`${ EnabledIdenfyService.IDENFY_BASE_URL }/redirect?authToken=${ session.authToken }`);
        locRequest.verify(instance => instance.initIdenfyVerification(session));
        locRequestRepository.verify(instance => instance.save(locRequest.object()));
    });

    it("handles callback", async () => {
        const { locRequest, idenfyService, locRequestRepository } = mockEnabledIdenfyService();

        const json = JSON.parse(RAW_IDENFY_PAYLOAD);
        await idenfyService.callback(json, Buffer.from(RAW_IDENFY_PAYLOAD));

        locRequest.verify(instance => instance.updateIdenfyVerification(json, RAW_IDENFY_PAYLOAD));
        for(const fileType of Object.keys(EXPECTED_FILES)) {
            locRequest.verify(instance => instance.addFile(It.Is<FileDescription>(
                file => file.cid === EXPECTED_FILES[fileType].cid
                && file.contentType === EXPECTED_FILES[fileType].contentType
                && file.nature === EXPECTED_FILES[fileType].nature
                && file.name === EXPECTED_FILES[fileType].name
                && file.submitter === LOC_OWNER
            )));
        }
        locRequestRepository.verify(instance => instance.save(locRequest.object()));
    });
});

function setupProcessEnv() {
    process.env.IDENFY_SECRET = IDENFY_SECRET;
    process.env.IDENFY_API_KEY = IDENFY_API_KEY;
    process.env.IDENFY_API_SECRET = IDENFY_API_SECRET;
    process.env.BASE_URL = BASE_URL;
}

function tearDownProcessEnv() {
    delete process.env.GOERLI_ALCHEMY_KEY;
}

const REQUEST_ID = "21cc7dbf-7af1-4014-acfd-05bc4a110c82";
const BASE_URL = "https://node.logion.network";
const IDENFY_SECRET = "some-secret";
const IDENFY_API_KEY = "api-key";
const IDENFY_API_SECRET = "api-secret";
const IDENFY_SCAN_REF = "3af0b5c9-8ef3-4815-8796-5ab3ed942917";
const LOC_OWNER = ALICE;

function mockEnabledIdenfyService(): {
    locRequest: Mock<LocRequestAggregateRoot>,
    locRequestRepository: Mock<LocRequestRepository>,
    locRequestService: Mock<LocRequestService>,
    fileStorageService: Mock<FileStorageService>,
    axiosFactory: Mock<AxiosFactory>,
    idenfyService: EnabledIdenfyService,
    authenticatedAxios: Mock<AxiosInstance>,
} {
    const locRequest = new Mock<LocRequestAggregateRoot>();
    locRequest.setup(instance => instance.id).returns(REQUEST_ID);
    locRequest.setup(instance => instance.ownerAddress).returns(LOC_OWNER);
    const description = new Mock<LocRequestDescription>();
    description.setup(instance => instance.userIdentity).returns({
        firstName: "John",
        lastName: "Doe",
        email: "john@logion.network",
        phoneNumber: "+1234",
    });
    locRequest.setup(instance => instance.getDescription()).returns(description.object());
    locRequest.setup(instance => instance.isIdenfySessionInProgress()).returns(false);
    locRequest.setup(instance => instance.canInitIdenfyVerification()).returns({ result: true });
    locRequest.setup(instance => instance.initIdenfyVerification(It.IsAny())).returns();
    locRequest.setup(instance => instance.updateIdenfyVerification(It.IsAny(), It.IsAny())).returns();
    locRequest.setup(instance => instance.addFile(It.IsAny())).returns();

    const locRequestRepository = new Mock<LocRequestRepository>();
    locRequestRepository.setup(instance => instance.findById(REQUEST_ID)).returnsAsync(locRequest.object());
    locRequestRepository.setup(instance => instance.save(It.IsAny())).returnsAsync();

    const locRequestService = new Mock<LocRequestService>();

    const fileStorageService = new Mock<FileStorageService>();
    // In reverse order of actual addition by service, otherwise CIDs won't match
    fileStorageService
        .setup(instance => instance.importFile(It.IsAny()))
        .play(PlayTimes.Once())
        .returnsAsync(EXPECTED_FILES.FACE.cid!);
    fileStorageService
        .setup(instance => instance.importFile(It.IsAny()))
        .play(PlayTimes.Once())
        .returnsAsync(EXPECTED_FILES.BACK.cid!);
    fileStorageService
        .setup(instance => instance.importFile(It.IsAny()))
        .play(PlayTimes.Once())
        .returnsAsync(EXPECTED_FILES.FRONT.cid!);
    fileStorageService
        .setup(instance => instance.importFile(It.IsAny()))
        .play(PlayTimes.Once())
        .returnsAsync(EXPECTED_FILES.PAYLOAD.cid!);

    const axiosFactory = new Mock<AxiosFactory>();
    const authenticatedAxios = new Mock<AxiosInstance>();
    axiosFactory.setup(instance => instance.create(It.Is<CreateAxiosDefaults>(
        config => config.baseURL === EnabledIdenfyService.IDENFY_BASE_URL
        && config.auth?.username === IDENFY_API_KEY
        && config.auth?.password === IDENFY_API_SECRET
    ))).returns(authenticatedAxios.object());

    const defaultAxios = new Mock<AxiosInstance>();
    defaultAxios.setup(instance => instance.get(FRONT_URL, It.Is<AxiosRequestConfig<any>>(config => config.responseType === "stream")))
        .returnsAsync(buildStreamResponse("front"));
    defaultAxios.setup(instance => instance.get(BACK_URL, It.Is<AxiosRequestConfig<any>>(config => config.responseType === "stream")))
        .returnsAsync(buildStreamResponse("back"));
    defaultAxios.setup(instance => instance.get(FACE_URL, It.Is<AxiosRequestConfig<any>>(config => config.responseType === "stream")))
        .returnsAsync(buildStreamResponse("face"));
    axiosFactory.setup(instance => instance.create()).returns(defaultAxios.object());

    const idenfyService = new EnabledIdenfyService(
        locRequestRepository.object(),
        new NonTransactionalLocRequestService(locRequestRepository.object()),
        fileStorageService.object(),
        axiosFactory.object(),
    );
    return {
        locRequest,
        locRequestRepository,
        locRequestService,
        fileStorageService,
        axiosFactory,
        idenfyService,
        authenticatedAxios,
    };
}

// based on https://documentation.idenfy.com/callbacks/ResultCallback#examples
const FRONT_URL = "https://s3.eu-west-1.amazonaws.com/production.users.storage/users_storage/users/some-hash/FRONT.png?AWSAccessKeyId=some-key&Signature=some-sig&Expires=1671104387";
const BACK_URL = "https://s3.eu-west-1.amazonaws.com/production.users.storage/users_storage/users/some-hash/BACK.png?AWSAccessKeyId=some-key&Signature=some-sig&Expires=1671104387";
const FACE_URL = "https://s3.eu-west-1.amazonaws.com/production.users.storage/users_storage/users/some-hash/FACE.png?AWSAccessKeyId=some-key&Signature=some-sig&Expires=1671104387";
const RAW_IDENFY_PAYLOAD = `{
    "clientId": "${ REQUEST_ID }",
    "scanRef": "${ IDENFY_SCAN_REF }",
    "externalRef": "external-ref",
    "platform": "MOBILE_APP",
    "startTime": 1554726960, 
    "finishTime": 1554727002,
    "clientIp": "192.0.2.0",
    "clientIpCountry": "LT",
    "clientLocation": "Kaunas, Lithuania",
    "final": true,
    "status": {
        "overall": "APPROVED",
        "suspicionReasons": [],
        "mismatchTags": [],
        "fraudTags": [],
        "autoDocument": "DOC_VALIDATED",
        "autoFace": "FACE_MATCH",
        "manualDocument": "DOC_VALIDATED",
        "manualFace": "FACE_MATCH",
        "additionalSteps": null
    },
    "data": {
        "docFirstName": "FIRST-NAME-EXAMPLE",
        "docLastName": "LAST-NAME-EXAMPLE",
        "docNumber": "XXXXXXXXX",
        "docPersonalCode": "XXXXXXXXX",
        "docExpiry": "YYYY-MM-DD",
        "docDob": "YYYY-MM-DD",
        "docType": "ID_CARD",
        "docSex": "UNDEFINED",
        "docNationality": "LT",
        "docIssuingCountry": "LT",
        "manuallyDataChanged": false,
        "fullName": "FULL-NAME-EXAMPLE",
        "selectedCountry": "LT",
        "orgFirstName": "FIRST-NAME-EXAMPLE",
        "orgLastName":  "LAST-NAME-EXAMPLE",
        "orgNationality": "LIETUVOS",
        "orgBirthPlace": "ŠILUVA",
        "orgAuthority": null,
        "orgAddress": null,
        "selectedCountry": "LT",
        "ageEstimate": "UNDER_13",
        "clientIpProxyRiskLevel": "LOW",
        "duplicateDocFaces": null,
        "duplicateFaces": null,
        "additionalData": {
            "UTILITY_BILL": {
                "ssn": {
                    "value": "ssn number",
                    "status": "MATCH"
                }
            }
        },
        "manualAddress": null,
        "manualAddressMatch": false
    },
    "fileUrls": {
        "FRONT": "${ FRONT_URL }",
        "BACK": "${ BACK_URL }",
        "FACE": "${ FACE_URL }"
    },
    "AML": [
        {
            "status": {
                "serviceSuspected": false,
                "checkSuccessful": true,
                "serviceFound": true,
                "serviceUsed": true,
                "overallStatus": "NOT_SUSPECTED"
            },
            "data": [],
            "serviceName": "PilotApiAmlV2",
            "serviceGroupType": "AML",
            "uid": "OHT8GR5ESRF5XROWE5ZGCC123",
            "errorMessage": null
        }
    ],
    "LID": [
        {
            "status": {
                "serviceSuspected": false,
                "checkSuccessful": true,
                "serviceFound": true,
                "serviceUsed": true,
                "overallStatus": "NOT_SUSPECTED"
            },
            "data": [],
            "serviceName": "IrdInvalidPapers",
            "serviceGroupType": "LID",
            "uid": "OHT8GR5ESRF5XROWE5ZGCC123",
            "errorMessage": null
        }
    ]
}`;

const EXPECTED_FILES: Record<string, Partial<FileDescription>> = {
    FACE: {
        cid: "cid-3",
        contentType: "image/png",
        nature: "iDenfy FACE",
        name: "FACE.png",
    },
    BACK: {
        cid: "cid-2",
        contentType: "image/png",
        nature: "iDenfy BACK",
        name: "BACK.png",
    },
    FRONT: {
        cid: "cid-1",
        contentType: "image/png",
        nature: "iDenfy FRONT",
        name: "FRONT.png",
    },
    PAYLOAD: {
        cid: "cid-0",
        contentType: "application/json",
        nature: "iDenfy Verification Result",
        name: "idenfy-callback-payload.json",
    },
};

function buildStreamResponse(data: string): AxiosResponse {
    const response = new Mock<AxiosResponse>();
    response.setup(instance => instance.data).returns(Readable.from(Buffer.from(data)));
    const headers = new Mock<AxiosResponseHeaders>();
    headers.setup(instance => instance["content-type"]).returns("image/png");
    response.setup(instance => instance.headers).returns(headers.object());
    return response.object();
}
