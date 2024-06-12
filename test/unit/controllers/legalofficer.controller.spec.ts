import { TestApp } from "@logion/rest-api-core";
import request from "supertest";
import { Container } from "inversify";
import { Mock, It } from "moq.ts";

import { LegalOfficerController } from "../../../src/logion/controllers/legalofficer.controller.js";
import {
    LegalOfficerRepository,
    LegalOfficerAggregateRoot,
    LegalOfficerFactory,
    LegalOfficerDescription,
} from "../../../src/logion/model/legalofficer.model.js";
import { ValidAccountId } from "@logion/node-api";
import { DB_SS58_PREFIX } from "../../../src/logion/model/supportedaccountid.model.js";
import { LEGAL_OFFICERS } from "../../helpers/addresses.js";
import { LegalOfficerService } from "../../../src/logion/services/legalOfficerService.js";

const AUTHENTICATED_ADDRESS = LEGAL_OFFICERS[0].account;
const { setupApp, mockAuthenticationForUserOrLegalOfficer } = TestApp;

describe("LegalOfficerController", () => {

    it("should fetch all legal officers", async () => {

        const app = setupApp(LegalOfficerController, mockForFetch)
        await request(app)
            .get("/api/legal-officer")
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.legalOfficers.length).toBe(LEGAL_OFFICERS.length)
            });
    });

    it("should fetch one legal officer", async () => {
        const app = setupApp(LegalOfficerController, mockForFetch)
        await request(app)
            .get("/api/legal-officer/vQx5kESPn8dWyX4KxMCKqUyCaWUwtui1isX6PVNcZh2Ghjitr")
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.address).toBe("vQx5kESPn8dWyX4KxMCKqUyCaWUwtui1isX6PVNcZh2Ghjitr")
                const userIdentity = response.body.userIdentity;
                expect(userIdentity.firstName).toBe("Alice")
                expect(userIdentity.lastName).toBe("Alice")
                expect(userIdentity.email).toBe("alice@logion.network")
                expect(userIdentity.phoneNumber).toBe("+32 498 00 00 00")
                let postalAddress = response.body.postalAddress;
                expect(postalAddress.company).toBe("MODERO")
                expect(postalAddress.line1).toBe("Huissier de Justice Etterbeek")
                expect(postalAddress.line2).toBe("Rue Beckers 17")
                expect(postalAddress.postalCode).toBe("1040")
                expect(postalAddress.city).toBe("Etterbeek")
                expect(postalAddress.country).toBe("Belgique")
            });
    })

    it("creates or updates details for a legal officer", async () => {
        const payload = { ...LEGAL_OFFICERS[0] }
        const app = setupApp(LegalOfficerController, mockForCreateOrUpdate, mockAuthenticationForUserOrLegalOfficer(true, AUTHENTICATED_ADDRESS))
        await request(app)
            .put("/api/legal-officer")
            .send(payload)
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .then(response => {
                expect(response.body.address).toBe(AUTHENTICATED_ADDRESS.address)
                const userIdentity = response.body.userIdentity;
                expect(userIdentity.firstName).toBe("Alice")
                expect(userIdentity.lastName).toBe("Alice")
                expect(userIdentity.email).toBe("alice@logion.network")
                expect(userIdentity.phoneNumber).toBe("+32 498 00 00 00")
                let postalAddress = response.body.postalAddress;
                expect(postalAddress.company).toBe("MODERO")
                expect(postalAddress.line1).toBe("Huissier de Justice Etterbeek")
                expect(postalAddress.line2).toBe("Rue Beckers 17")
                expect(postalAddress.postalCode).toBe("1040")
                expect(postalAddress.city).toBe("Etterbeek")
                expect(postalAddress.country).toBe("Belgique")
            });
    })

    it("fails to create or update details for a legal officer", async () => {
        const payload = { ...LEGAL_OFFICERS[0] }
        const app = setupApp(LegalOfficerController, mockForCreateOrUpdate, mockAuthenticationForUserOrLegalOfficer(false))
        await request(app)
            .put("/api/legal-officer")
            .send(payload)
            .expect(401)
            .expect('Content-Type', /application\/json/);
    })
})

function mockForFetch(container: Container) {
    const repository = new Mock<LegalOfficerRepository>();
    container.bind(LegalOfficerRepository).toConstantValue(repository.object());

    const legalOfficer0 = mockLegalOfficer(repository, 0);
    const legalOfficers = [
        legalOfficer0,
        mockLegalOfficer(repository, 1),
        mockLegalOfficer(repository, 2),
    ];
    repository.setup(instance => instance.findAll())
        .returns(Promise.resolve(legalOfficers));
    repository.setup(instance => instance.findByAccount(It.IsAny<string>()))
        .returns(Promise.resolve(legalOfficer0));

    const factory = new Mock<LegalOfficerFactory>();
    container.bind(LegalOfficerFactory).toConstantValue(factory.object());

    const directoryService = new Mock<LegalOfficerService>();
    container.bind(LegalOfficerService).toConstantValue(directoryService.object());
}

function mockForCreateOrUpdate(container: Container) {
    const repository = new Mock<LegalOfficerRepository>();
    container.bind(LegalOfficerRepository).toConstantValue(repository.object());
    const legalOfficer0 = mockLegalOfficer(repository, 0);
    const legalOfficers = [
        legalOfficer0,
        mockLegalOfficer(repository, 1),
        mockLegalOfficer(repository, 2),
    ];
    repository.setup(instance => instance.findAll())
        .returns(Promise.resolve(legalOfficers));

    const factory = new Mock<LegalOfficerFactory>();
    container.bind(LegalOfficerFactory).toConstantValue(factory.object());
    factory.setup(instance => instance.newLegalOfficer(It.IsAny<LegalOfficerDescription>()))
        .returns(legalOfficer0);

    const directoryService = new Mock<LegalOfficerService>();
    container.bind(LegalOfficerService).toConstantValue(directoryService.object());
    directoryService.setup(instance => instance.createOrUpdateLegalOfficer(It.IsAny<LegalOfficerAggregateRoot>()))
        .returns(Promise.resolve());
}

function mockLegalOfficer(repository: Mock<LegalOfficerRepository>, idx:number):LegalOfficerAggregateRoot {
    const legalOfficer = new Mock<LegalOfficerAggregateRoot>();
    legalOfficer.setup(instance => instance.getDescription()).returns(LEGAL_OFFICERS[idx]);
    legalOfficer.setup(instance => instance.address).returns(LEGAL_OFFICERS[idx].account.getAddress(DB_SS58_PREFIX));
    repository.setup(instance => instance.findByAccount(It.Is<ValidAccountId>(account => account.equals(LEGAL_OFFICERS[idx].account))))
        .returns(Promise.resolve(legalOfficer.object()));
    return legalOfficer.object();
}
