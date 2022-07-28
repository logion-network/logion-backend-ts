import { connect, executeScript, disconnect, checkNumOfRows } from "../../helpers/testdb";
import { SessionAggregateRoot, SessionRepository } from "../../../src/logion/model/session.model";
import moment from "moment";

describe('SessionRepository', () => {

    const userAddress = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
    const existingSessionId = '0d9c1ca7-a2c5-48f7-b0fb-e66a977bc7b5';
    const anotherExistingSessionId = 'fc4bfdc6-9e79-4959-9dd5-fde5b38f1f88';
    const unknownSessionId = '5c03194a-1c07-4c7d-b9eb-3df722c15ae9';


    beforeAll(async () => {
        await connect([ SessionAggregateRoot ]);
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

    it("saves session", async () => {
        // Given
        const session = new SessionAggregateRoot();
        session.userAddress = "5FhGVcrmPpHutfbsR3d472Usrtk18Nk9sgVec5y3ApHf4jaK";
        session.sessionId = "17b1fa11-155e-4c78-a2bc-6d0b478b90bb"
        session.createdOn = moment().toDate()
        // When
        await repository.save(session)
        // Then
        await checkNumOfRows(`SELECT *
                              FROM session
                              WHERE session_id = '${ session.sessionId }'`, 1)
    })

    it("deletes session", async () => {
        // Given
        const session = new SessionAggregateRoot();
        session.userAddress = "5Ff2hkmpSZvgbj7aasT8Webo8hWUHdDGR74JqLUGQwFyhG6r";
        session.sessionId = anotherExistingSessionId
        session.createdOn = moment().toDate()
        // When
        await repository.delete(session)
        // Then
        await checkNumOfRows(`SELECT *
                              FROM session
                              WHERE session_id = '${ session.sessionId }'`, 0)
    })
})

