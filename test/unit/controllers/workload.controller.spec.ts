import { TestApp } from "@logion/rest-api-core";
import { Container } from "inversify";
import { Mock, It } from "moq.ts";
import request from "supertest";
import { ALICE, BOB } from "../../helpers/addresses.js";
import { WorkloadController } from "../../../src/logion/controllers/workload.controller.js";
import { WorkloadService } from "../../../src/logion/services/workload.service.js";

const { setupApp } = TestApp;

describe("WorkloadController", () => {

    it("provides expected workload", async () => {
        const app = setupApp(WorkloadController, mockForFetch)
        await request(app)
            .put(`/api/workload`)
            .send({
                legalOfficerAddresses: [ ALICE, BOB ]
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
    service.setup(instance => instance.workloadOf(It.Is<string[]>(params =>
        params.includes(ALICE) &&
        params.includes(BOB)
    ))).returnsAsync({
        ALICE: 42,
        BOB: 24,
    });
    container.bind(WorkloadService).toConstantValue(service.object());
}
