import { TestApp } from "@logion/rest-api-core";
import { Container } from "inversify";
import { Mock, It } from "moq.ts";
import request from "supertest";
import { ALICE_ACCOUNT, BOB_ACCOUNT } from "../../helpers/addresses.js";
import { WorkloadController } from "../../../src/logion/controllers/workload.controller.js";
import { WorkloadService } from "../../../src/logion/services/workload.service.js";
import { ValidAccountId } from "@logion/node-api";

const { setupApp } = TestApp;

describe("WorkloadController", () => {

    it("provides expected workload", async () => {
        const app = setupApp(WorkloadController, mockForFetch)
        await request(app)
            .put(`/api/workload`)
            .send({
                legalOfficerAddresses: [ ALICE_ACCOUNT.address, BOB_ACCOUNT.address ]
            })
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .expect(response => {
                expect(response.body.workloads.ALICE).toEqual(42);
                expect(response.body.workloads.BOB).toEqual(24);
            });
    });
});

function mockForFetch(container: Container) {
    const service = new Mock<WorkloadService>();
    service.setup(instance => instance.workloadOf(It.Is<ValidAccountId[]>(params =>
        params[0].equals(ALICE_ACCOUNT) &&
        params[1].equals(BOB_ACCOUNT)
    ))).returnsAsync({
        ALICE: 42,
        BOB: 24,
    });
    container.bind(WorkloadService).toConstantValue(service.object());
}
