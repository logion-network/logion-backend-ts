import { Container } from 'inversify';
import { It, Mock } from 'moq.ts';
import request from 'supertest';
import { TestApp } from '@logion/rest-api-core';
import { SettingController } from '../../../src/logion/controllers/setting.controller.js';
import {
    SettingAggregateRoot,
    SettingFactory,
    SettingRepository,
    SettingDescription
} from '../../../src/logion/model/setting.model.js';
import { NonTransactionalSettingService, SettingService } from '../../../src/logion/services/settings.service.js';
import { ALICE, ALICE_ACCOUNT } from "../../helpers/addresses.js";
import { LegalOfficerSettingId } from "../../../src/logion/model/legalofficer.model.js";
import { ItIsAccount } from "../../helpers/Mock.js";
import { DB_SS58_PREFIX } from "../../../src/logion/model/supportedaccountid.model.js";

const { setupApp } = TestApp;

describe("SettingController", () => {

    it("lists settings", async () => {
        const app = setupApp(SettingController, container => mockForList(container));
        await request(app)
            .get(`/api/setting/${ ALICE }`)
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .expect(response => {
                expect(response.body.settings).toBeDefined();
                expect(response.body.settings[settingId]).toBe(settingValue);
            });
    });

    it("creates setting", async () => {
        const app = setupApp(SettingController, container => mockForCreate(container));
        await request(app)
            .put(`/api/setting/${ ALICE }/${ settingId }`)
            .send({ value: settingValue })
            .expect(200);
        settingRepository.verify(instance => instance.save(setting.object()));
    });

    it("updates setting", async () => {
        const app = setupApp(SettingController, container => mockForUpdate(container));
        await request(app)
            .put(`/api/setting/${ ALICE }/${ settingId }`)
            .send({ value: settingValue })
            .expect(200);
        setting.verify(instance => instance.update(settingValue));
        settingRepository.verify(instance => instance.save(setting.object()));
    });
});

let settingRepository: Mock<SettingRepository>;
let settingFactory: Mock<SettingFactory>;
let setting: Mock<SettingAggregateRoot>;

function mockForList(container: Container) {
    createAndBindMocks(container);

    setting.setup(instance => instance.id).returns(settingId);
    setting.setup(instance => instance.legalOfficerAddress).returns(ALICE_ACCOUNT.getAddress(DB_SS58_PREFIX));
    setting.setup(instance => instance.value).returns(settingValue);

    settingRepository.setup(instance => instance.findByLegalOfficer(ItIsAccount(ALICE_ACCOUNT))).returnsAsync([ setting.object() ]);
}

function createAndBindMocks(container: Container) {
    setting = new Mock<SettingAggregateRoot>();

    settingFactory = new Mock<SettingFactory>();
    container.bind(SettingFactory).toConstantValue(settingFactory.object());

    settingRepository = new Mock<SettingRepository>();
    container.bind(SettingRepository).toConstantValue(settingRepository.object());

    container.bind(SettingService).toConstantValue(new NonTransactionalSettingService(settingRepository.object(), settingFactory.object()));
}

function mockForCreate(container: Container) {
    createAndBindMocks(container);

    settingFactory.setup(instance => instance
        .newSetting(It.Is<SettingDescription>(args => args.id === settingId && args.legalOfficer.equals(ALICE_ACCOUNT) && args.value === settingValue)))
        .returns(setting.object());

    settingRepository.setup(instance => instance
        .findById(It.Is<LegalOfficerSettingId>(args => args.id === settingId && args.legalOfficer.equals(ALICE_ACCOUNT))))
        .returnsAsync(null);
    settingRepository.setup(instance => instance.save(setting.object())).returnsAsync();
}

const settingId = "some-id";
const settingValue = "value";

function mockForUpdate(container: Container) {
    createAndBindMocks(container);

    setting.setup(instance => instance.update(settingValue)).returns();

    settingRepository.setup(instance => instance
        .findById(It.Is<LegalOfficerSettingId>(args => args.id === settingId && args.legalOfficer.equals(ALICE_ACCOUNT))))
        .returnsAsync(setting.object());
    settingRepository.setup(instance => instance.save(setting.object())).returnsAsync();
}
