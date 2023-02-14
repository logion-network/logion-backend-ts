import { LogionNodeApi, UUID } from "@logion/node-api";
import { TestApp } from "@logion/rest-api-core";
import { ALICE, AuthenticationServiceMock, mockAuthenticationWithAuthenticatedUser } from "@logion/rest-api-core/dist/TestApp.js";
import { AuthenticatedUser } from "@logion/authenticator";
import { Option } from "@polkadot/types-codec";
import { PalletLogionLocVerifiedIssuer } from "@polkadot/types/lookup";
import { Container } from "inversify";
import { Mock } from "moq.ts";
import request from "supertest";
import { VerifiedThirdPartyController } from "../../../src/logion/controllers/verifiedthirdparty.controller.js";
import { buildMocksForUpdate, mockPolkadotIdentityLoc, REQUESTER_ADDRESS, REQUEST_ID, setupLoc, setupRequest, userIdentities } from "./locrequest.controller.shared.js";
import { UserIdentity } from "src/logion/model/useridentity.js";
import { UnauthorizedException } from "dinoloop/modules/builtin/exceptions/exceptions.js";

const { setupApp } = TestApp;

describe("VerifiedThirdPartyController", () => {

    it("provides selected issuers identity to requester", async () => {
        await testGetSelectedVerifiedIssuers(mockAuthenticationForUserOrLegalOfficer(false, REQUESTER_ADDRESS));
    });

    it("provides selected issuers identity to owner", async () => {
        await testGetSelectedVerifiedIssuers(mockAuthenticationForUserOrLegalOfficer(true, ALICE));
    });

    it("provides selected issuers identity to issuer", async () => {
        await testGetSelectedVerifiedIssuers(mockAuthenticationForUserOrLegalOfficer(false, VTP_ADDRESS));
    });
});

async function testGetSelectedVerifiedIssuers(authMock: AuthenticationServiceMock) {
    const app = setupApp(VerifiedThirdPartyController, mockModelForSelected, authMock);
        await request(app)
            .get(`/api/loc-request/${ REQUEST_ID }/issuers-identity`)
            .expect(200)
            .then(response => {
                expect(response.body.issuers).toBeDefined();
                expect(response.body.issuers.length).toBe(1);
                expect(response.body.issuers[0].address).toBe(VTP_ADDRESS);
                expect(response.body.issuers[0].identity).toBeDefined();
                expect(response.body.issuers[0].identityLocId).toBe(ISSUER_IDENTITY_LOC_ID);
            });
}

function mockModelForSelected(container: Container) {
    const { nodeApi, maybeVerifiedIssuer } = mockModelCommon(container);

    nodeApi.setup(instance => instance.query.logionLoc.verifiedIssuersMap(ALICE, VTP_ADDRESS)).returnsAsync(maybeVerifiedIssuer.object());
}

function mockModelCommon(container: Container): {
    nodeApi: Mock<LogionNodeApi>,
    maybeVerifiedIssuer: Mock<Option<PalletLogionLocVerifiedIssuer>>,
} {
    const { nodeApi, request, repository, loc } = buildMocksForUpdate(container);
    setupRequest(request, REQUEST_ID, "Transaction", "OPEN", { userIdentity: { email: VTP_EMAIL } as UserIdentity });

    mockPolkadotIdentityLoc(repository, true);

    setupLoc(loc, "Transaction", false);

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

    const maybeVerifiedIssuer = new Mock<Option<PalletLogionLocVerifiedIssuer>>();
    maybeVerifiedIssuer.setup(instance => instance.isSome).returns(true);
    maybeVerifiedIssuer.setup(instance => instance.isNone).returns(false);
    const verifiedIssuer = new Mock<PalletLogionLocVerifiedIssuer>();
    verifiedIssuer.setup(instance => instance.identityLoc.toString()).returns(new UUID(ISSUER_IDENTITY_LOC_ID).toDecimalString());
    maybeVerifiedIssuer.setup(instance => instance.unwrap()).returns(verifiedIssuer.object());

    return { nodeApi, maybeVerifiedIssuer };
}

const VTP_EMAIL = userIdentities["Polkadot"].userIdentity?.email;
const VTP_ADDRESS = "5FniDvPw22DMW1TLee9N8zBjzwKXaKB2DcvZZCQU5tjmv1kb";
const ISSUER_IDENTITY_LOC_ID = userIdentities["Polkadot"].identityLocId!;

function mockAuthenticationForUserOrLegalOfficer(isLegalOfficer: boolean, address: string) { // Should be fixed in @logion/rest-api-core
    const authenticatedUser = new Mock<AuthenticatedUser>();
    authenticatedUser.setup(instance => instance.address).returns(address); // Should be fixed in @logion/rest-api-core
    authenticatedUser.setup(instance => instance.is).returns((given: string) => given === address); // Should be fixed in @logion/rest-api-core
    authenticatedUser.setup(instance => instance.isOneOf).returns((given: (string | undefined)[]) => given.includes(address)); // Should be fixed in @logion/rest-api-core
    authenticatedUser.setup(instance => instance.require).returns((predicate) => {
        if(!predicate(authenticatedUser.object())) {
            throw new UnauthorizedException();
        } else {
            return authenticatedUser.object();
        }
    });
    authenticatedUser.setup(instance => instance.isNodeOwner()).returns(isLegalOfficer);
    authenticatedUser.setup(instance => instance.isLegalOfficer()).returnsAsync(isLegalOfficer);
    authenticatedUser.setup(instance => instance.requireLegalOfficerOnNode).returns(() => {
        if (isLegalOfficer) {
            return Promise.resolve(authenticatedUser.object())
        } else {
            throw new UnauthorizedException();
        }
    })
    return mockAuthenticationWithAuthenticatedUser(authenticatedUser.object());
}
