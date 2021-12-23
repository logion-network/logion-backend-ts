import { SessionFactory, SessionAggregateRoot, NewSessionParameters } from "../../../src/logion/model/session.model";
import { v4 as uuid } from 'uuid';
import { ALICE } from "../../helpers/addresses";
import moment from "moment";

describe("SessionFactory", () => {

    it("createSession", () => {
        const sessionId = givenSessionId()
        const params = { sessionId, userAddress: ALICE, createdOn: moment() }
        whenCreatingSession(params);
        thenSessionCreatedWith(params)
    })
})

function whenCreatingSession(params: NewSessionParameters) {
    session = factory.newSession(params)
}

function givenSessionId(): string {
    return uuid();
}

const factory = new SessionFactory();
let session: SessionAggregateRoot;

function thenSessionCreatedWith(params: NewSessionParameters) {
    expect(session.sessionId).toBe(params.sessionId);
    expect(session.userAddress).toBe(params.userAddress);
    expect(session.createdOn).toEqual(params.createdOn.toDate());
}
