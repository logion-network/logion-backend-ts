import { AuthenticationService } from "../../../src/logion/services/authentication.service";
import { Mock } from "moq.ts";
import { Request } from "express";

describe('AuthenticationService', () => {

    const USER_TOKEN = "eyJhbGciOiJIUzM4NCIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE2MzEyMTc2MTEsImxlZ2FsT2ZmaWNlciI6ZmFsc2UsImV4cCI6NDc4NDgxNzYxMSwiaXNzIjoiZGV2LmxvZ2lvbi5uZXR3b3JrIiwic3ViIjoiNUg0TXZBc29iZlo2YkJDRHlqNWRzcldZTHJBOEhyUnphcWE5cDYxVVh0eE1oU0NZIn0.cbVabXf6XzCp62XjhrJfrM11nk2zmsOCGRyjizC4h_IxGaDT1qFRRSi9bkqVQZSL"
    const USER_ADDRESS = "5H4MvAsobfZ6bBCDyj5dsrWYLrA8HrRzaqa9p61UXtxMhSCY"
    const TTL = 100 * 365 * 24 * 3600; // 100 years

    process.env.JWT_SECRET = "Y2hhbmdlLW1lLXBsZWFzZQ==";

    it('generates a token for user', () => {

        const authenticationService = new AuthenticationService();
        expect(authenticationService.createToken(USER_ADDRESS, 1631217611000, TTL)).toBe(USER_TOKEN)
    })

    it('authenticates user based on token', () => {
        const authenticationService = new AuthenticationService();
        const request = new Mock<Request>();
        request.setup(instance => instance.header("Authorization")).returns("Bearer " + USER_TOKEN)
        authenticationService.authenticatedUserIs(request.object(), USER_ADDRESS);
    })
})
