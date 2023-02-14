import { LogionNodeApi, UUID } from "@logion/node-api";
import { TestApp } from "@logion/rest-api-core";
import { ALICE, mockAuthenticationForUserOrLegalOfficer } from "@logion/rest-api-core/dist/TestApp.js";
import { Option } from "@polkadot/types-codec";
import { PalletLogionLocVerifiedIssuer } from "@polkadot/types/lookup";
import { Container } from "inversify";
import { Mock } from "moq.ts";
import request from "supertest";
import { VerifiedThirdPartyController } from "../../../src/logion/controllers/verifiedthirdparty.controller.js";
import { buildMocksForUpdate, mockPolkadotIdentityLoc, REQUEST_ID, setupLoc, setupRequest, userIdentities } from "./locrequest.controller.shared.js";
import { UserIdentity } from "src/logion/model/useridentity.js";

const { setupApp } = TestApp;

describe("VerifiedThirdPartyController", () => {

    it("provides selected issuers identity to requester", async () => {
        const app = setupApp(VerifiedThirdPartyController, mockModelForSelected, mockAuthenticationForUserOrLegalOfficer(true, ALICE));
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
    });
});

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
