import { connect, executeScript, disconnect } from "../../helpers/testdb";
import { SessionAggregateRoot, SessionRepository } from "../../../src/logion/model/session.model";

describe('SessionRepository', () => {

    const userAddress = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
    const existingSessionId = '0d9c1ca7-a2c5-48f7-b0fb-e66a977bc7b5';
    const unknownSessionId = '5c03194a-1c07-4c7d-b9eb-3df722c15ae9';


    beforeAll(async () => {
        await connect([SessionAggregateRoot]);
        await executeScript("test/integration/model/sessions.sql");
        repository = new SessionRepository();
    });

    let repository: SessionRepository;

    afterAll(async () => {
        await disconnect();
    });

    it("finds existing session", async () => {
        const session = await repository.find(userAddress, existingSessionId);
        expect(session).toBeDefined();
    })

    it("does not find unknown sessionId", async () => {
        const session = await repository.find(userAddress, unknownSessionId);
        expect(session).toBeUndefined();
    })

    it("does not find unknown userAddress", async () => {
        const session = await repository.find('unknown', existingSessionId);
        expect(session).toBeUndefined();
    })
})
