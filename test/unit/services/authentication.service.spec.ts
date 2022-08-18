import { AuthenticationService, LogionUserCheck } from "../../../src/logion/services/authentication.service";
import { Mock, It } from "moq.ts";
import { Request } from "express";
import moment from "moment";
import { UnauthorizedException } from "dinoloop/modules/builtin/exceptions/exceptions";
import { ALICE } from "../../helpers/addresses";
import { AuthorityService } from "../../../src/logion/services/authority.service";
import { NodeAuthorizationService } from "../../../src/logion/services/nodeauthorization.service";
import { NodeSignatureService } from "../../../src/logion/services/nodesignature.service";

const USER_TOKEN = "eyJhbGciOiJFZERTQSJ9.eyJpYXQiOjE2MzEyMTc2MTEsImV4cCI6NDc4NDgxNzYxMSwiaXNzIjoiMTJEM0tvb1dEQ3VHVTdXWTNWYVdqQlMxRTQ0eDRFbm1UZ0szSFJ4V0ZxWUczZHFYRGZQMSIsInN1YiI6IjVINE12QXNvYmZaNmJCQ0R5ajVkc3JXWUxyQThIclJ6YXFhOXA2MVVYdHhNaFNDWSJ9.pBYUyYxq2I_HZiYyeJ-rc8ANxVgckLyd2Y1Snu685mDK4fSwanb6EHsMAP47iCtzSxhaB5bDu7zDmY-XMAyuAw"
const USER_TOKEN_WRONG_SIGNATURE = "eyJhbGciOiJFZERTQSJ9.eyJpYXQiOjE2MzEyMTc2MTEsImV4cCI6NDc4NDgxNzYxMSwiaXNzIjoiMTJEM0tvb1dEQ3VHVTdXWTNWYVdqQlMxRTQ0eDRFbm1UZ0szSFJ4V0ZxWUczZHFYRGZQMSIsInN1YiI6IjVINE12QXNvYmZaNmJCQ0R5ajVkc3JXWUxyQThIclJ6YXFhOXA2MVVYdHhNaFNDWSJ9.GTLJB_uMjsdcuWzM3CWL92n1UNI0WYXFUDW7QQ1Vi6k3TQIEvG_WwMuuZ2d9cexY"
const ALICE_TOKEN = "eyJhbGciOiJFZERTQSJ9.eyJpYXQiOjE2MjM2NzQwOTksImV4cCI6MTgyMzY3NDA5OSwiaXNzIjoiMTJEM0tvb1dEQ3VHVTdXWTNWYVdqQlMxRTQ0eDRFbm1UZ0szSFJ4V0ZxWUczZHFYRGZQMSIsInN1YiI6IjVHcnd2YUVGNXpYYjI2Rno5cmNRcERXUzU3Q3RFUkhwTmVoWENQY05vSEdLdXRRWSJ9.GggMsAlDO2GoRFm8IBxuHKVtZ7Ms1pipCTzzoaDbGxXGhm4niFX_kEetMVdXo69oG0vI7XWfWHs7Z-x-nOjUCQ"
const USER_ADDRESS = "5H4MvAsobfZ6bBCDyj5dsrWYLrA8HrRzaqa9p61UXtxMhSCY"
const TTL = 100 * 365 * 24 * 3600; // 100 years

process.env.JWT_SECRET = "1c482e5368b84abe08e1a27d0670d303351989b3aa281cb1abfc2f48e4530b57";
process.env.JWT_ISSUER = "12D3KooWDCuGU7WY3VaWjBS1E44x4EnmTgK3HRxWFqYG3dqXDfP1";
process.env.JWT_TTL_SEC = "3600";
process.env.OWNER = ALICE;

describe('AuthenticationService createToken()', () => {

    it('generates a token for user', async () => {
        givenAuthorityService();
        givenNodeAuthorizationService();
        const authenticationService = new AuthenticationService(
            authorityService.object(),
            nodeAuthorizationService.object(),
            new NodeSignatureService(),
        );
        const actual = await authenticationService.createToken(USER_ADDRESS, moment.unix(1631217611), TTL);
        expect(actual.value).toBe(USER_TOKEN)
        expect(actual.expiredOn.unix).toBe(moment.unix(1631217611 + TTL).unix)
    })
})

function givenAuthorityService(isLegalOfficer?: boolean) {
    authorityService = new Mock<AuthorityService>();
    authorityService.setup(instance => instance.isLegalOfficer(It.IsAny<string>()))
        .returns(Promise.resolve(isLegalOfficer ? isLegalOfficer : false))
}

let authorityService: Mock<AuthorityService>;

function givenNodeAuthorizationService(isWellKnownNode: boolean = true) {
    nodeAuthorizationService = new Mock<NodeAuthorizationService>()
    nodeAuthorizationService.setup(instance => instance.isWellKnownNode(It.IsAny<string>()))
        .returns(Promise.resolve(isWellKnownNode))
}

let nodeAuthorizationService: Mock<NodeAuthorizationService>;

describe('AuthenticationService authenticatedUserIs()', () => {

    it('authenticates user based on token', async () => {
        givenAuthorityService();
        givenNodeAuthorizationService();
        const authenticationService = new AuthenticationService(
            authorityService.object(),
            nodeAuthorizationService.object(),
            new NodeSignatureService(),
        );
        const request = new Mock<Request>();
        request.setup(instance => instance.header("Authorization")).returns("Bearer " + USER_TOKEN)
        const logionUser = await authenticationService.authenticatedUserIs(request.object(), USER_ADDRESS);
        expect(logionUser.address).toBe(USER_ADDRESS)
    })

    it('authenticates node owner based on token', async () => {
        givenAuthorityService(true);
        givenNodeAuthorizationService();
        const authenticationService = new AuthenticationService(
            authorityService.object(),
            nodeAuthorizationService.object(),
            new NodeSignatureService(),
        );
        const request = new Mock<Request>();
        request.setup(instance => instance.header("Authorization")).returns("Bearer " + ALICE_TOKEN)
        const logionUser = await authenticationService.authenticatedUserIs(request.object(), ALICE);
        await logionUser.requireNodeOwner();
    })

    it('does not authenticate user different from token', async () => {
        await testForFailure((authenticationService: AuthenticationService, request: Request) =>
            authenticationService.authenticatedUserIs(request, "SOME-OTHER-USER")
        , "Bearer " + USER_TOKEN, "User has not access to this resource")
    })

    it('does not authenticate null user', async () => {
        await testForFailure((authenticationService: AuthenticationService, request: Request) =>
            authenticationService.authenticatedUserIs(request, null)
        , "Bearer " + USER_TOKEN, "User has not access to this resource")
    })

    it('does not authenticate undefined user', async () => {
        await testForFailure((authenticationService: AuthenticationService, request: Request) =>
            authenticationService.authenticatedUserIs(request, undefined)
        , "Bearer " + USER_TOKEN, "User has not access to this resource")
    })

    it('does not authenticate invalid header', async () => {
        await testForFailure((authenticationService: AuthenticationService, request: Request) =>
            authenticationService.authenticatedUserIs(request, "SOME-OTHER-USER")
        , "fake-auth-header", "No token found")
    })

    it('does not authenticate fake token', async () => {
        await testForFailure((authenticationService: AuthenticationService, request: Request) =>
            authenticationService.authenticatedUserIs(request, USER_ADDRESS)
        , "Bearer FAKE", "JWTInvalid: Invalid JWT")
    })

    it('does not authenticate token with wrong signature', async () => {
        await testForFailure((authenticationService: AuthenticationService, request: Request) =>
            authenticationService.authenticatedUserIs(request, USER_ADDRESS)
        , "Bearer " + USER_TOKEN_WRONG_SIGNATURE, "JWSSignatureVerificationFailed: signature verification failed")
    })

    it('does not authenticate token for unknown node', async () => {
        await testForFailure((authenticationService: AuthenticationService, request: Request) =>
            authenticationService.authenticatedUserIs(request, USER_ADDRESS)
        , "Bearer " + USER_TOKEN, "Invalid issuer", false)
    })
})

describe('AuthenticationService authenticatedUserIsOneOf()', () => {

    it('authenticates user based on token', () => {
        givenAuthorityService();
        givenNodeAuthorizationService();
        const authenticationService = new AuthenticationService(
            authorityService.object(),
            nodeAuthorizationService.object(),
            new NodeSignatureService(),
        );
        const request = new Mock<Request>();
        request.setup(instance => instance.header("Authorization")).returns("Bearer " + USER_TOKEN)
        authenticationService.authenticatedUserIsOneOf(request.object(), "FAKE ADDRESS", USER_ADDRESS);
    })

    it('authenticates legal officer based on token', async () => {
        givenAuthorityService(true);
        givenNodeAuthorizationService();
        const authenticationService = new AuthenticationService(
            authorityService.object(),
            nodeAuthorizationService.object(),
            new NodeSignatureService(),
        );
        const request = new Mock<Request>();
        request.setup(instance => instance.header("Authorization")).returns("Bearer " + ALICE_TOKEN)
        const logionUser = await authenticationService.authenticatedUserIsOneOf(request.object(), "FAKE ADDRESS", ALICE);
        await logionUser.requireNodeOwner();
    })
})

async function testForFailure(fnToCheck: (authenticationService: AuthenticationService, request: Request) => Promise<LogionUserCheck>, authHeader: string, expectedError: string, isWellKnownNode: boolean = true) {
    givenAuthorityService()
    givenNodeAuthorizationService(isWellKnownNode)
    const authenticationService = new AuthenticationService(
        authorityService.object(),
        nodeAuthorizationService.object(),
        new NodeSignatureService(),
    );
    const request = new Mock<Request>();
    request.setup(instance => instance.header("Authorization")).returns(authHeader)

    try {
        await fnToCheck(authenticationService, request.object())
        fail("Call should not succeed while testing for failure.")
    } catch (error) {
        expect(error).toBeInstanceOf(UnauthorizedException)
        const unauthorized = error as UnauthorizedException<{ error: string }>;
        expect(unauthorized.content.error).toEqual(expectedError)
    }
}
