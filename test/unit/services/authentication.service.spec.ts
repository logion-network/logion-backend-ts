import { AuthenticatedUser, AuthenticationSystem, Authenticator } from "@logion/authenticator";
import { Mock } from "moq.ts";
import { Request } from "express";
import { UnauthorizedException } from "dinoloop/modules/builtin/exceptions/exceptions";

import { AuthenticationService } from "../../../src/logion/services/authentication.service";
import { AuthenticationSystemFactory } from "../../../src/logion/services/authenticationsystemfactory.service";

const USER_TOKEN = "eyJhbGciOiJFZERTQSJ9.eyJpYXQiOjE2MzEyMTc2MTEsImV4cCI6NDc4NDgxNzYxMSwiaXNzIjoiMTJEM0tvb1dEQ3VHVTdXWTNWYVdqQlMxRTQ0eDRFbm1UZ0szSFJ4V0ZxWUczZHFYRGZQMSIsInN1YiI6IjVINE12QXNvYmZaNmJCQ0R5ajVkc3JXWUxyQThIclJ6YXFhOXA2MVVYdHhNaFNDWSJ9.pBYUyYxq2I_HZiYyeJ-rc8ANxVgckLyd2Y1Snu685mDK4fSwanb6EHsMAP47iCtzSxhaB5bDu7zDmY-XMAyuAw"
const USER_ADDRESS = "5H4MvAsobfZ6bBCDyj5dsrWYLrA8HrRzaqa9p61UXtxMhSCY"

describe('AuthenticationService authenticatedUserIs()', () => {

    it('builds AuthenticatedUser object from Bearer', async () => {
        givenAuthenticationSystemFactory();
        const authenticationService = new AuthenticationService(authenticationSystemFactory.object());
        const request = new Mock<Request>();
        request.setup(instance => instance.header("Authorization")).returns("Bearer " + USER_TOKEN)
        const logionUser = await authenticationService.authenticatedUser(request.object());
        expect(logionUser.address).toBe(USER_ADDRESS);
    })

    it('does not authenticate invalid header', async () => {
        givenAuthenticationSystemFactory();
        const authenticationService = new AuthenticationService(authenticationSystemFactory.object());
        const request = new Mock<Request>();
        request.setup(instance => instance.header("Authorization")).returns("Bad auth header");
        await expectAsync(authenticationService.authenticatedUser(request.object())).toBeRejectedWith(new UnauthorizedException({ error: "No token found" }));
    })
})

function givenAuthenticationSystemFactory() {
    const authenticator = new Mock<Authenticator>();
    const userAuthenticatedUser = new Mock<AuthenticatedUser>();
    userAuthenticatedUser.setup(instance => instance.address).returns(USER_ADDRESS);
    authenticator.setup(instance => instance.ensureAuthenticatedUserOrThrow(USER_TOKEN)).returnsAsync(userAuthenticatedUser.object());

    const authenticationSystem = new Mock<AuthenticationSystem>();
    authenticationSystem.setup(instance => instance.authenticator).returns(authenticator.object());
    authenticationSystemFactory = new Mock<AuthenticationSystemFactory>();
    authenticationSystemFactory.setup(instance => instance.authenticationSystem()).returnsAsync(authenticationSystem.object());
}

let authenticationSystemFactory: Mock<AuthenticationSystemFactory>;
