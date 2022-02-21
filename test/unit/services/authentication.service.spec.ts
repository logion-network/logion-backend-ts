import { AuthenticationService } from "../../../src/logion/services/authentication.service";
import { Mock, It } from "moq.ts";
import { Request } from "express";
import moment from "moment";
import { UnauthorizedException } from "dinoloop/modules/builtin/exceptions/exceptions";
import { ALICE } from "../../helpers/addresses";
import { AuthorityService } from "../../../src/logion/services/authority.service";

const USER_TOKEN = "eyJhbGciOiJIUzM4NCIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE2MzEyMTc2MTEsImV4cCI6NDc4NDgxNzYxMSwiaXNzIjoiZXhhbXBsZS5vcmciLCJzdWIiOiI1SDRNdkFzb2JmWjZiQkNEeWo1ZHNyV1lMckE4SHJSemFxYTlwNjFVWHR4TWhTQ1kifQ.7X-8bX3l5MMDMBSjgjrZYEwXs07rL0xp5cvqn1ecQN7x1PH40eE4Cf1sDghKa8ER"
const USER_TOKEN_WRONG_SIGNATURE = "eyJhbGciOiJIUzM4NCIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE2MzEyMTc2MTEsImxlZ2FsT2ZmaWNlciI6ZmFsc2UsImV4cCI6NDc4NDgxNzYxMSwiaXNzIjoiZXhhbXBsZS5vcmciLCJzdWIiOiI1SDRNdkFzb2JmWjZiQkNEeWo1ZHNyV1lMckE4SHJSemFxYTlwNjFVWHR4TWhTQ1kifQ.GTLJB_uMjsdcuWzM3CWL92n1UNI0WYXFUDW7QQ1Vi6k3TQIEvG_WwMuuZ2d9cexY"
const ALICE_TOKEN = "eyJhbGciOiJIUzM4NCIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE2MzEyMTc2MTEsImV4cCI6NDc4NDgxNzYxMSwiaXNzIjoiZXhhbXBsZS5vcmciLCJzdWIiOiI1R3J3dmFFRjV6WGIyNkZ6OXJjUXBEV1M1N0N0RVJIcE5laFhDUGNOb0hHS3V0UVkifQ.WBsbj7ypc2ZO1IOGdgjLmzblWl9oOquReVODKmQyT_XjkqPL3epd-PxHZd6LJAxP"
const USER_ADDRESS = "5H4MvAsobfZ6bBCDyj5dsrWYLrA8HrRzaqa9p61UXtxMhSCY"
const TTL = 100 * 365 * 24 * 3600; // 100 years

process.env.JWT_SECRET = "Y2hhbmdlLW1lLXBsZWFzZQ==";
process.env.JWT_ISSUER = "example.org";
process.env.JWT_TTL_SEC = "3600";
process.env.OWNER = ALICE;

describe('AuthenticationService createToken()', () => {

    it('generates a token for user', async () => {
        givenAuthorityService();
        const authenticationService = new AuthenticationService(authorityService.object());
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

describe('AuthenticationService authenticatedUserIs()', () => {

    it('authenticates user based on token', () => {
        givenAuthorityService();
        const authenticationService = new AuthenticationService(authorityService.object());
        const request = new Mock<Request>();
        request.setup(instance => instance.header("Authorization")).returns("Bearer " + USER_TOKEN)
        const logionUser = authenticationService.authenticatedUserIs(request.object(), USER_ADDRESS);
        expect(logionUser.address).toBe(USER_ADDRESS)
    })

    it('authenticates node owner based on token', async () => {
        givenAuthorityService(true);
        const authenticationService = new AuthenticationService(authorityService.object());
        const request = new Mock<Request>();
        request.setup(instance => instance.header("Authorization")).returns("Bearer " + ALICE_TOKEN)
        const logionUser = authenticationService.authenticatedUserIs(request.object(), ALICE);
        await logionUser.requireNodeOwner();
    })

    it('does not authenticate user different from token', () => {
        givenAuthorityService();
        testForFailure((authenticationService: AuthenticationService, request: Request) => {
            authenticationService.authenticatedUserIs(request, "SOME-OTHER-USER");
        }, "Bearer " + USER_TOKEN, "User has not access to this resource")
    })

    it('does not authenticate null user', () => {
        givenAuthorityService();
        testForFailure((authenticationService: AuthenticationService, request: Request) => {
            authenticationService.authenticatedUserIs(request, null)
        }, "Bearer " + USER_TOKEN, "User has not access to this resource")
    })

    it('does not authenticate undefined user', () => {
        givenAuthorityService();
        testForFailure((authenticationService: AuthenticationService, request: Request) => {
            authenticationService.authenticatedUserIs(request, undefined)
        }, "Bearer " + USER_TOKEN, "User has not access to this resource")
    })

    it('does not authenticate invalid header', () => {
        givenAuthorityService();
        testForFailure((authenticationService: AuthenticationService, request: Request) => {
            authenticationService.authenticatedUserIs(request, "SOME-OTHER-USER")
        }, "fake-auth-header", "Invalid Authorization header")
    })

    it('does not authenticate fake token', () => {
        givenAuthorityService();
        testForFailure((authenticationService: AuthenticationService, request: Request) => {
            authenticationService.authenticatedUserIs(request, USER_ADDRESS)
        }, "Bearer FAKE", "JsonWebTokenError: jwt malformed")
    })

    it('does not authenticate token with wrong signature', () => {
        givenAuthorityService();
        testForFailure((authenticationService: AuthenticationService, request: Request) => {
            authenticationService.authenticatedUserIs(request, USER_ADDRESS)
        }, "Bearer " + USER_TOKEN_WRONG_SIGNATURE, "JsonWebTokenError: invalid signature")
    })
})

describe('AuthenticationService authenticatedUserIsOneOf()', () => {

    it('authenticates user based on token', () => {
        givenAuthorityService();
        const authenticationService = new AuthenticationService(authorityService.object());
        const request = new Mock<Request>();
        request.setup(instance => instance.header("Authorization")).returns("Bearer " + USER_TOKEN)
        authenticationService.authenticatedUserIsOneOf(request.object(), "FAKE ADDRESS", USER_ADDRESS);
    })

    it('authenticates legal officer based on token', async () => {
        givenAuthorityService(true);
        const authenticationService = new AuthenticationService(authorityService.object());
        const request = new Mock<Request>();
        request.setup(instance => instance.header("Authorization")).returns("Bearer " + ALICE_TOKEN)
        const logionUser = authenticationService.authenticatedUserIsOneOf(request.object(), "FAKE ADDRESS", ALICE);
        await logionUser.requireNodeOwner();
    })
})

function testForFailure(fnToCheck: (authenticationService: AuthenticationService, request: Request) => void, authHeader: string, expectedError: string) {
    const authenticationService = new AuthenticationService(authorityService.object());
    const request = new Mock<Request>();
    request.setup(instance => instance.header("Authorization")).returns(authHeader)

    let authentication = function () {
        fnToCheck(authenticationService, request.object());
    }
    expect(authentication).toThrowMatching((exception: UnauthorizedException<{ error: string }>) => {
        expect(exception.content.error).toBe(expectedError)
        return exception.content.error === expectedError
    })
}
