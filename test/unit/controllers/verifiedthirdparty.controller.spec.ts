import { TestApp } from "@logion/rest-api-core";
import { Container } from "inversify";
import request from "supertest";
import { VerifiedThirdPartyController } from "../../../src/logion/controllers/verifiedthirdparty.controller";
import { buildMocksForUpdate, REQUEST_ID, setupRequest } from "./locrequest.controller.shared";

const { setupApp } = TestApp;

describe("VerifiedThirdPartyController", () => {

    it('sets verified third party flag', async () => {
        const app = setupApp(VerifiedThirdPartyController, mockModelForSetVerifiedThirdParty)
        await request(app)
            .put(`/api/loc-request/${ REQUEST_ID }/verified-third-party`)
            .send({ isVerifiedThirdParty: true })
            .expect(204);
    })
})


function mockModelForSetVerifiedThirdParty(container: Container) {
    const { request } = buildMocksForUpdate(container);
    setupRequest(request, REQUEST_ID, "Identity", "CLOSED");
    request.setup(instance => instance.setVerifiedThirdParty(true)).returns(undefined);
}
