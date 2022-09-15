import { TestApp } from '@logion/rest-api-core';
import request from 'supertest';
import { Container } from "inversify";
import { It, Mock } from "moq.ts";
import { HealthController } from '../../../src/logion/controllers/health.controller';
import { SyncPointRepository } from '../../../src/logion/model/syncpoint.model';

const { setupApp, mockAuthenticationWithCondition } = TestApp;

describe('HealthController', () => {

    beforeEach(() => {
        process.env.HEALTH_TOKEN = EXPECTED_TOKEN;
    })

    it('OK when authenticated and up', async () => {
        const app = setupApp(HealthController, container => bindMocks(container, true));

        await request(app)
            .get('/api/health')
            .set('Authorization', `Bearer ${EXPECTED_TOKEN}`)
            .expect(200);
    });

    it('Unauthorized', async () => {
        const mock = mockAuthenticationWithCondition(false);
        const app = setupApp(HealthController, container => bindMocks(container, true), mock);

        await request(app)
            .get('/api/health')
            .set('Authorization', `Bearer ${UNEXPECTED_TOKEN}`)
            .expect(401);
    })

    it('Internal when authenticated and down', async () => {
        const app = setupApp(HealthController, container => bindMocks(container, false));

        await request(app)
            .get('/api/health')
            .set('Authorization', `Bearer ${EXPECTED_TOKEN}`)
            .expect(500);
    })
});

const EXPECTED_TOKEN = "the-health-check-token";

const UNEXPECTED_TOKEN = "wrong-health-check-token";

function bindMocks(container: Container, up: boolean): void {
    const syncPointRepository = new Mock<SyncPointRepository>();
    if(up) {
        syncPointRepository.setup(instance => instance.findByName(It.IsAny())).returns(Promise.resolve(null));
    } else {
        syncPointRepository.setup(instance => instance.findByName(It.IsAny())).throws(new Error("DB is down"));
    }
    container.bind(SyncPointRepository).toConstantValue(syncPointRepository.object());
}
