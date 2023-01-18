INSERT INTO vote(vote_id, loc_id, created_on, closed)
VALUES (1, 'c744db7c-181d-42d7-adc3-781e9fc4210f', '2022-10-01', true);

INSERT INTO ballot(vote_id, voter, result)
VALUES (1, '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', 'Yes');

INSERT INTO ballot(vote_id, voter, result)
VALUES (1, '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty', 'No');

INSERT INTO vote(vote_id, loc_id, created_on)
VALUES (2, '0f2343c9-4717-4bd4-a9ec-dc04ceee06e3', '2022-11-02');
