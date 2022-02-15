import { AuthenticationService } from "../../../src/logion/services/authentication.service";
import { Mock } from "moq.ts";
import { Request } from "express";
import moment from "moment";
import { UnauthorizedException } from "dinoloop/modules/builtin/exceptions/exceptions";
import { ALICE } from "../../helpers/addresses";
import { PolkadotService } from "src/logion/services/polkadot.service";
import { ApiPromise } from "@polkadot/api";

const USER_TOKEN = "eyJhbGciOiJIUzM4NCIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE2MzEyMTc2MTEsImxlZ2FsT2ZmaWNlciI6ZmFsc2UsImV4cCI6NDc4NDgxNzYxMSwiaXNzIjoiZXhhbXBsZS5vcmciLCJzdWIiOiI1SDRNdkFzb2JmWjZiQkNEeWo1ZHNyV1lMckE4SHJSemFxYTlwNjFVWHR4TWhTQ1kifQ.03P4Ehzp6cweQPct0tf-dBNmkXhFKYfcUYA1xbmPsdpRV9Dn2as1aZdp6neP2iOI"
const USER_TOKEN_WRONG_SIGNATURE = "eyJhbGciOiJIUzM4NCIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE2MzEyMTc2MTEsImxlZ2FsT2ZmaWNlciI6ZmFsc2UsImV4cCI6NDc4NDgxNzYxMSwiaXNzIjoiZXhhbXBsZS5vcmciLCJzdWIiOiI1SDRNdkFzb2JmWjZiQkNEeWo1ZHNyV1lMckE4SHJSemFxYTlwNjFVWHR4TWhTQ1kifQ.GTLJB_uMjsdcuWzM3CWL92n1UNI0WYXFUDW7QQ1Vi6k3TQIEvG_WwMuuZ2d9cexY"
const LEGAL_OFFICER_TOKEN = "eyJhbGciOiJIUzM4NCIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE2MzEyMTc2MTEsImxlZ2FsT2ZmaWNlciI6dHJ1ZSwiZXhwIjo0Nzg0ODE3NjExLCJpc3MiOiJleGFtcGxlLm9yZyIsInN1YiI6IjVINE12QXNvYmZaNmJCQ0R5ajVkc3JXWUxyQThIclJ6YXFhOXA2MVVYdHhNaFNDWSJ9.tZ-VKXDRt-3U7BrTogm1FmVtcC5L1krdYg_c2kAYDUnfjr-IG4s3msylYohjQLPd"
const USER_ADDRESS = "5H4MvAsobfZ6bBCDyj5dsrWYLrA8HrRzaqa9p61UXtxMhSCY"
const TTL = 100 * 365 * 24 * 3600; // 100 years

process.env.JWT_SECRET = "Y2hhbmdlLW1lLXBsZWFzZQ==";
process.env.JWT_ISSUER = "example.org";
process.env.JWT_TTL_SEC = "3600";
process.env.OWNER = ALICE;

describe('AuthenticationService createToken()', () => {

    it('generates a token for user', async () => {
        givenPolkadotService();
        const authenticationService = new AuthenticationService(polkadotService.object());
        const actual = await authenticationService.createToken(USER_ADDRESS, moment.unix(1631217611), TTL);
        expect(actual.value).toBe(USER_TOKEN)
        expect(actual.expiredOn.unix).toBe(moment.unix(1631217611 + TTL).unix)
    })
})

function givenPolkadotService(legalOfficerAddress?: string) {
    polkadotService = new Mock<PolkadotService>();
    const api: any = {
        query: {
            loAuthorityList: {
                legalOfficerSet: (address: string) => {
                    if(address === legalOfficerAddress) {
                        return Promise.resolve({
                            isSome: true,
                            unwrap: () => ({
                                isTrue: true
                            })
                        });
                    } else {
                        return Promise.resolve({
                            isSome: false,
                            unwrap: () => { throw new Error() }
                        });
                    }
                }
            }
        }
    };
    polkadotService.setup(instance => instance.readyApi()).returns(Promise.resolve(api as ApiPromise));
}

let polkadotService: Mock<PolkadotService>;

describe('AuthenticationService authenticatedUserIs()', () => {

    it('authenticates user based on token', () => {
        givenPolkadotService();
        const authenticationService = new AuthenticationService(polkadotService.object());
        const request = new Mock<Request>();
        request.setup(instance => instance.header("Authorization")).returns("Bearer " + USER_TOKEN)
        const logionUser = authenticationService.authenticatedUserIs(request.object(), USER_ADDRESS);
        expect(logionUser.legalOfficer).toBe(false);
    })

    it('authenticates legal officer based on token', () => {
        givenPolkadotService(USER_ADDRESS);
        const authenticationService = new AuthenticationService(polkadotService.object());
        const request = new Mock<Request>();
        request.setup(instance => instance.header("Authorization")).returns("Bearer " + LEGAL_OFFICER_TOKEN)
        const logionUser = authenticationService.authenticatedUserIs(request.object(), USER_ADDRESS);
        expect(logionUser.legalOfficer).toBe(true);
        logionUser.requireLegalOfficer();
    })

    it('does not authenticate user different from token', () => {
        givenPolkadotService();
        testForFailure((authenticationService: AuthenticationService, request: Request) => {
            authenticationService.authenticatedUserIs(request, "SOME-OTHER-USER")
        }, "Bearer " + USER_TOKEN, "User has not access to this resource")
    })

    it('does not authenticate null user', () => {
        givenPolkadotService();
        testForFailure((authenticationService: AuthenticationService, request: Request) => {
            authenticationService.authenticatedUserIs(request, null)
        }, "Bearer " + USER_TOKEN, "User has not access to this resource")
    })

    it('does not authenticate undefined user', () => {
        givenPolkadotService();
        testForFailure((authenticationService: AuthenticationService, request: Request) => {
            authenticationService.authenticatedUserIs(request, undefined)
        }, "Bearer " + USER_TOKEN, "User has not access to this resource")
    })

    it('does not authenticate invalid header', () => {
        givenPolkadotService();
        testForFailure((authenticationService: AuthenticationService, request: Request) => {
            authenticationService.authenticatedUserIs(request, "SOME-OTHER-USER")
        }, "fake-auth-header", "Invalid Authorization header")
    })

    it('does not authenticate regular user as legal officer', () => {
        givenPolkadotService();
        testForFailure((authenticationService: AuthenticationService, request: Request) => {
            authenticationService.authenticatedUserIs(request, USER_ADDRESS)
                .requireLegalOfficer();
        }, "Bearer " + USER_TOKEN, "Reserved to legal officer")
    })

    it('does not authenticate fake token', () => {
        givenPolkadotService();
        testForFailure((authenticationService: AuthenticationService, request: Request) => {
            authenticationService.authenticatedUserIs(request, USER_ADDRESS);
        }, "Bearer FAKE", "JsonWebTokenError: jwt malformed")
    })

    it('does not authenticate token with wrong signature', () => {
        givenPolkadotService();
        testForFailure((authenticationService: AuthenticationService, request: Request) => {
            authenticationService.authenticatedUserIs(request, USER_ADDRESS);
        }, "Bearer " + USER_TOKEN_WRONG_SIGNATURE, "JsonWebTokenError: invalid signature")
    })
})

describe('AuthenticationService authenticatedUserIsOneOf()', () => {

    it('authenticates user based on token', () => {
        givenPolkadotService();
        const authenticationService = new AuthenticationService(polkadotService.object());
        const request = new Mock<Request>();
        request.setup(instance => instance.header("Authorization")).returns("Bearer " + USER_TOKEN)
        const logionUser = authenticationService.authenticatedUserIsOneOf(request.object(), "FAKE ADDRESS", USER_ADDRESS);
        expect(logionUser.legalOfficer).toBe(false);
    })

    it('authenticates legal officer based on token', () => {
        givenPolkadotService(USER_ADDRESS);
        const authenticationService = new AuthenticationService(polkadotService.object());
        const request = new Mock<Request>();
        request.setup(instance => instance.header("Authorization")).returns("Bearer " + LEGAL_OFFICER_TOKEN)
        const logionUser = authenticationService.authenticatedUserIsOneOf(request.object(), "FAKE ADDRESS", USER_ADDRESS);
        expect(logionUser.legalOfficer).toBe(true);
        logionUser.requireLegalOfficer();
    })
})

function testForFailure(fnToCheck: (authenticationService: AuthenticationService, request: Request) => void, authHeader: string, expectedError: string) {
    const authenticationService = new AuthenticationService(polkadotService.object());
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
