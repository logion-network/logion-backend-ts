-- Pending requests
INSERT INTO loc_request (id, owner_address, requester_address, description, status)
VALUES (md5(random()::text || clock_timestamp()::text)::uuid, '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', '5CXLTF2PFBE89tTYsrofGPkSfGTdmW4ciw4vAfgcKhjggRgZ', 'loc-1', 'PENDING');
INSERT INTO loc_request (id, owner_address, requester_address, description, status)
VALUES (md5(random()::text || clock_timestamp()::text)::uuid, '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', '5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW', 'loc-2', 'PENDING');
INSERT INTO loc_request (id, owner_address, requester_address, description, status)
VALUES (md5(random()::text || clock_timestamp()::text)::uuid, '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty', '5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW', 'loc-3', 'PENDING');
-- Started requests
INSERT INTO loc_request (id, owner_address, requester_address, description, status)
VALUES (md5(random()::text || clock_timestamp()::text)::uuid, '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', '5CXLTF2PFBE89tTYsrofGPkSfGTdmW4ciw4vAfgcKhjggRgZ', 'loc-4', 'STARTED');
INSERT INTO loc_request (id, owner_address, requester_address, description, status)
VALUES (md5(random()::text || clock_timestamp()::text)::uuid, '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', '5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW', 'loc-5', 'STARTED');
INSERT INTO loc_request (id, owner_address, requester_address, description, status)
VALUES (md5(random()::text || clock_timestamp()::text)::uuid, '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty', '5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW', 'loc-6', 'STARTED');
-- Rejected requests
INSERT INTO loc_request (id, owner_address, requester_address, description, status, reject_reason)
VALUES (md5(random()::text || clock_timestamp()::text)::uuid, '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', '5CXLTF2PFBE89tTYsrofGPkSfGTdmW4ciw4vAfgcKhjggRgZ', 'loc-7', 'REJECTED', 'Not a valid case');
INSERT INTO loc_request (id, owner_address, requester_address, description, status, reject_reason)
VALUES (md5(random()::text || clock_timestamp()::text)::uuid, '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', '5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW', 'loc-8', 'REJECTED', 'Not a valid case');
INSERT INTO loc_request (id, owner_address, requester_address, description, status, reject_reason)
VALUES (md5(random()::text || clock_timestamp()::text)::uuid, '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty', '5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW', 'loc-9', 'REJECTED', 'Not a valid case');
