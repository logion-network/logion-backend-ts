import { TestApp } from "@logion/rest-api-core";
import { Container } from "inversify";
import { Mock } from "moq.ts";
import request from "supertest";
import { ALICE } from "../../helpers/addresses.js";
import { WorkloadController } from "../../../src/logion/controllers/workload.controller.js";
import { WorkloadService } from "../../../src/logion/services/workload.service.js";

const { setupApp } = TestApp;

describe("WorkloadController", () => {

    it("provides expected workload", async () => {
        const app = setupApp(WorkloadController, mockForFetch)
        await request(app)
            .get(`/api/workload/${ ALICE }`)
            .send()
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .expect(response => {
                expect(response.body.workload).toEqual(42);
        });
    });
});

function mockForFetch(container: Container) {
    const service = new Mock<WorkloadService>();
    service.setup(instance => instance.workloadOf(ALICE)).returnsAsync(42);
    container.bind(WorkloadService).toConstantValue(service.object());
}
