/* eslint-disable import/no-anonymous-default-export */
export default {
    types: {
        FullIdentification: 'Exposure',
        IdentificationTuple: '(ValidatorId, FullIdentification)',
        MembershipProof: {
            session: 'SessionIndex',
            trieNodes: 'Vec<Vec<u8>>',
            validatorCount: 'ValidatorCount'
        },
        SessionIndex: 'u32',
        ValidatorCount: 'u32',
        SessionKeys2: "(AccountId, AccountId)",
        Keys: "SessionKeys2"
    }
};
