-- Pending requests
INSERT INTO tokenization_request (id, requested_token_name, legal_officer_address, requester_address, bars, status) VALUES (md5(random()::text || clock_timestamp()::text)::uuid, 'MYT1', '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', '5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW', 1, 'PENDING');
INSERT INTO tokenization_request (id, requested_token_name, legal_officer_address, requester_address, bars, status) VALUES (md5(random()::text || clock_timestamp()::text)::uuid, 'MYT2', '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', '5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW', 2, 'PENDING');
INSERT INTO tokenization_request (id, requested_token_name, legal_officer_address, requester_address, bars, status) VALUES (md5(random()::text || clock_timestamp()::text)::uuid, 'MYT3', '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty', '5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW', 3, 'PENDING');

-- Accepted requests
INSERT INTO tokenization_request (
    id,
    requested_token_name,
    legal_officer_address,
    requester_address,
    bars,
    status,
    accept_session_token_hash
) VALUES (
    md5(random()::text || clock_timestamp()::text)::uuid,
    'MYT4',
    '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
    '5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW',
    3,
    'ACCEPTED',
    'session-token'
);
INSERT INTO tokenization_request (
    id,
    requested_token_name,
    legal_officer_address,
    requester_address,
    bars,
    status,
    asset_id,
    decimals
) VALUES (
    md5(random()::text || clock_timestamp()::text)::uuid,
    'MYT5',
    '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
    '5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW',
    3,
    'ACCEPTED',
    'assetId',
    18
);
