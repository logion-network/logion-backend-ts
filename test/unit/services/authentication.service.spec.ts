import { AuthenticationService } from "../../../src/logion/services/authentication.service";
import { Mock } from "moq.ts";
import { Request } from "express";
import moment from "moment";
import { UnauthorizedException } from "dinoloop/modules/builtin/exceptions/exceptions";

const USER_TOKEN = "eyJhbGciOiJIUzM4NCIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE2MzEyMTc2MTEsImxlZ2FsT2ZmaWNlciI6ZmFsc2UsImV4cCI6NDc4NDgxNzYxMSwiaXNzIjoiZGV2LmxvZ2lvbi5uZXR3b3JrIiwic3ViIjoiNUg0TXZBc29iZlo2YkJDRHlqNWRzcldZTHJBOEhyUnphcWE5cDYxVVh0eE1oU0NZIn0.cbVabXf6XzCp62XjhrJfrM11nk2zmsOCGRyjizC4h_IxGaDT1qFRRSi9bkqVQZSL"
const USER_TOKEN_WRONG_SIGNATURE = "eyJhbGciOiJIUzM4NCIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE2MzQzNzEyMTEwMDAsImV4cCI6MTYzNDM3MTIxMTAwMCwibGVnYWxPZmZpY2VyIjpmYWxzZSwiaXNzIjoiZGV2LmxvZ2lvbi5uZXR3b3JrIiwic3ViIjoiNUg0TXZBc29iZlo2YkJDRHlqNWRzcldZTHJBOEhyUnphcWE5cDYxVVh0eE1oU0NZIn0.GTLJB_uMjsdcuWzM3CWL92n1UNI0WYXFUDW7QQ1Vi6k3TQIEvG_WwMuuZ2d9cexY"
const LEGAL_OFFICER_TOKEN = "eyJhbGciOiJIUzM4NCIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE2MzEyMTc2MTEsImxlZ2FsT2ZmaWNlciI6dHJ1ZSwiZXhwIjo0Nzg0ODE3NjExLCJpc3MiOiJkZXYubG9naW9uLm5ldHdvcmsiLCJzdWIiOiI1SDRNdkFzb2JmWjZiQkNEeWo1ZHNyV1lMckE4SHJSemFxYTlwNjFVWHR4TWhTQ1kifQ.M4Qc8pgm7T_7BZTlHCZoJ6DbnK7eIJYr2g5HX2eJVv_4ZDqiA-42tX1BnI-j3mFC"
const USER_ADDRESS = "5H4MvAsobfZ6bBCDyj5dsrWYLrA8HrRzaqa9p61UXtxMhSCY"
const TTL = 100 * 365 * 24 * 3600; // 100 years

process.env.JWT_SECRET = "Y2hhbmdlLW1lLXBsZWFzZQ==";

describe('AuthenticationService createToken()', () => {

    it('generates a token for user', () => {
        const authenticationService = new AuthenticationService();
        const actual = authenticationService.createToken(USER_ADDRESS, moment.unix(1631217611), TTL);
        expect(actual.value).toBe(USER_TOKEN)
        expect(actual.expiredOn.unix).toBe(moment.unix(1631217611 + TTL).unix)
    })
})

describe('AuthenticationService authenticatedUserIs()', () => {

    it('authenticates user based on token', () => {
        const authenticationService = new AuthenticationService();
        const request = new Mock<Request>();
        request.setup(instance => instance.header("Authorization")).returns("Bearer " + USER_TOKEN)
        const logionUser = authenticationService.authenticatedUserIs(request.object(), USER_ADDRESS);
        expect(logionUser.legalOfficer).toBe(false);
    })

    it('authenticates legal officer based on token', () => {
        const authenticationService = new AuthenticationService();
        const request = new Mock<Request>();
        request.setup(instance => instance.header("Authorization")).returns("Bearer " + LEGAL_OFFICER_TOKEN)
        const logionUser = authenticationService.authenticatedUserIs(request.object(), USER_ADDRESS);
        expect(logionUser.legalOfficer).toBe(true);
        logionUser.requireLegalOfficer();
    })

    it('does not authenticate user different from token', () => {
        testForFailure((authenticationService: AuthenticationService, request: Request) => {
            authenticationService.authenticatedUserIs(request, "SOME-OTHER-USER")
        }, "Bearer " + USER_TOKEN, "User has not access to this resource")
    })

    it('does not authenticate null user', () => {
        testForFailure((authenticationService: AuthenticationService, request: Request) => {
            authenticationService.authenticatedUserIs(request, null)
        }, "Bearer " + USER_TOKEN, "User has not access to this resource")
    })

    it('does not authenticate undefined user', () => {
        testForFailure((authenticationService: AuthenticationService, request: Request) => {
            authenticationService.authenticatedUserIs(request, undefined)
        }, "Bearer " + USER_TOKEN, "User has not access to this resource")
    })

    it('does not authenticate invalid header', () => {
        testForFailure((authenticationService: AuthenticationService, request: Request) => {
            authenticationService.authenticatedUserIs(request, "SOME-OTHER-USER")
        }, "fake-auth-header", "Invalid Authorization header")
    })

    it('does not authenticate regular user as legal officer', () => {
        testForFailure((authenticationService: AuthenticationService, request: Request) => {
            authenticationService.authenticatedUserIs(request, USER_ADDRESS)
                .requireLegalOfficer();
        }, "Bearer " + USER_TOKEN, "Reserved to legal officer")
    })

    it('does not authenticate fake token', () => {
        testForFailure((authenticationService: AuthenticationService, request: Request) => {
            authenticationService.authenticatedUserIs(request, USER_ADDRESS);
        }, "Bearer FAKE", "JsonWebTokenError: jwt malformed")
    })

    it('does not authenticate token with wrong signature', () => {
        testForFailure((authenticationService: AuthenticationService, request: Request) => {
            authenticationService.authenticatedUserIs(request, USER_ADDRESS);
        }, "Bearer " + USER_TOKEN_WRONG_SIGNATURE, "JsonWebTokenError: invalid signature")
    })
})

describe('AuthenticationService authenticatedUserIsOneOf()', () => {

    it('authenticates user based on token', () => {
        const authenticationService = new AuthenticationService();
        const request = new Mock<Request>();
        request.setup(instance => instance.header("Authorization")).returns("Bearer " + USER_TOKEN)
        const logionUser = authenticationService.authenticatedUserIsOneOf(request.object(), "FAKE ADDRESS", USER_ADDRESS);
        expect(logionUser.legalOfficer).toBe(false);
    })

    it('authenticates legal officer based on token', () => {
        const authenticationService = new AuthenticationService();
        const request = new Mock<Request>();
        request.setup(instance => instance.header("Authorization")).returns("Bearer " + LEGAL_OFFICER_TOKEN)
        const logionUser = authenticationService.authenticatedUserIsOneOf(request.object(), "FAKE ADDRESS", USER_ADDRESS);
        expect(logionUser.legalOfficer).toBe(true);
        logionUser.requireLegalOfficer();
    })
})

function testForFailure(fnToCheck: (authenticationService: AuthenticationService, request: Request) => void, authHeader: string, expectedError: string) {
    const authenticationService = new AuthenticationService();
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
