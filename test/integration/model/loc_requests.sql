-- Requested locs
INSERT INTO loc_request (id, owner_address, requester_address, description, status, loc_type)
VALUES (md5(random()::text || clock_timestamp()::text)::uuid, '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', '5CXLTF2PFBE89tTYsrofGPkSfGTdmW4ciw4vAfgcKhjggRgZ', 'loc-1', 'REQUESTED', 'Transaction');
INSERT INTO loc_request (id, owner_address, requester_address, description, status, loc_type)
VALUES (md5(random()::text || clock_timestamp()::text)::uuid, '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', '5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW', 'loc-2', 'REQUESTED', 'Transaction');
INSERT INTO loc_request (id, owner_address, requester_address, description, status, loc_type)
VALUES (md5(random()::text || clock_timestamp()::text)::uuid, '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty', '5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW', 'loc-3', 'REQUESTED', 'Transaction');
-- Open locs
INSERT INTO loc_request (id, owner_address, requester_address, description, status, loc_type)
VALUES (md5(random()::text || clock_timestamp()::text)::uuid, '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', '5CXLTF2PFBE89tTYsrofGPkSfGTdmW4ciw4vAfgcKhjggRgZ', 'loc-4', 'OPEN', 'Transaction');
INSERT INTO loc_request (id, owner_address, requester_address, description, status, loc_type)
VALUES (md5(random()::text || clock_timestamp()::text)::uuid, '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', '5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW', 'loc-5', 'OPEN', 'Transaction');
INSERT INTO loc_request (id, owner_address, requester_address, description, status, loc_type)
VALUES (md5(random()::text || clock_timestamp()::text)::uuid, '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty', '5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW', 'loc-6', 'OPEN', 'Transaction');
-- Rejected locs
INSERT INTO loc_request (id, owner_address, requester_address, description, status, reject_reason, first_name, last_name, email, phone_number, loc_type)
VALUES (md5(random()::text || clock_timestamp()::text)::uuid, '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', '5CXLTF2PFBE89tTYsrofGPkSfGTdmW4ciw4vAfgcKhjggRgZ', 'loc-7', 'REJECTED', 'Not a valid case', 'John', 'Doe', 'john.doe@logion.network', '+123456', 'Transaction');
INSERT INTO loc_request (id, owner_address, requester_address, description, status, reject_reason, loc_type)
VALUES (md5(random()::text || clock_timestamp()::text)::uuid, '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', '5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW', 'loc-8', 'REJECTED', 'Not a valid case', 'Transaction');
INSERT INTO loc_request (id, owner_address, requester_address, description, status, reject_reason, loc_type)
VALUES (md5(random()::text || clock_timestamp()::text)::uuid, '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty', '5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW', 'loc-9', 'REJECTED', 'Not a valid case', 'Transaction');
-- Loc with files and metadata
INSERT INTO loc_request (id, owner_address, requester_address, description, status, loc_type)
VALUES ('2b287596-f9d5-8030-b606-d1da538cb37f', '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', '5CXLTF2PFBE89tTYsrofGPkSfGTdmW4ciw4vAfgcKhjggRgZ', 'loc-10', 'OPEN', 'Transaction');
INSERT INTO loc_request_file (request_id, hash, name, oid, content_type, added_on, "index", draft)
VALUES ('2b287596-f9d5-8030-b606-d1da538cb37f', '0x1307990e6ba5ca145eb35e99182a9bec46531bc54ddf656a602c780fa0240dee', 'a file', 123456, 'text/plain', '2021-10-06T11:16:00.000', 0, TRUE);
INSERT INTO loc_metadata_item (request_id, "index", name, "value", added_on)
VALUES ('2b287596-f9d5-8030-b606-d1da538cb37f', 0, 'a name', 'a value', '2021-10-06T11:16:00.000');
