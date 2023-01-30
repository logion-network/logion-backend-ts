-- Requested Transaction locs
INSERT INTO loc_request (id, owner_address, requester_address, description, status, loc_type)
VALUES (md5(random()::text || clock_timestamp()::text)::uuid, '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', '5CXLTF2PFBE89tTYsrofGPkSfGTdmW4ciw4vAfgcKhjggRgZ', 'loc-1', 'REQUESTED', 'Transaction');
INSERT INTO loc_request (id, owner_address, requester_address, description, status, loc_type)
VALUES (md5(random()::text || clock_timestamp()::text)::uuid, '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', '5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW', 'loc-2', 'REQUESTED', 'Transaction');
INSERT INTO loc_request (id, owner_address, requester_address, description, status, loc_type)
VALUES (md5(random()::text || clock_timestamp()::text)::uuid, '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty', '5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW', 'loc-3', 'REQUESTED', 'Transaction');
-- Open Transaction locs
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
-- Loc with files, metadata and links
INSERT INTO loc_request (id, owner_address, requester_address, description, status, loc_type)
VALUES ('2b287596-f9d5-8030-b606-d1da538cb37f', '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', '5CXLTF2PFBE89tTYsrofGPkSfGTdmW4ciw4vAfgcKhjggRgZ', 'loc-10', 'OPEN', 'Transaction');
INSERT INTO loc_request_file (request_id, hash, name, oid, content_type, added_on, "index", draft, nature, submitter)
VALUES ('2b287596-f9d5-8030-b606-d1da538cb37f', '0x1307990e6ba5ca145eb35e99182a9bec46531bc54ddf656a602c780fa0240dee', 'a file', 123456, 'text/plain', '2021-10-06T11:16:00.000', 0, TRUE, 'some nature', '5DDGQertEH5qvKVXUmpT3KNGViCX582Qa2WWb8nGbkmkRHvw');
INSERT INTO loc_metadata_item (request_id, "index", name, "value_text", added_on, draft, submitter)
VALUES ('2b287596-f9d5-8030-b606-d1da538cb37f', 0, 'a name', 'a value', '2021-10-06T11:16:00.000', true, '5DDGQertEH5qvKVXUmpT3KNGViCX582Qa2WWb8nGbkmkRHvw');
INSERT INTO loc_link (request_id, "index", target, added_on, draft, nature)
VALUES ('2b287596-f9d5-8030-b606-d1da538cb37f', 0, 'ec126c6c-64cf-4eb8-bfa6-2a98cd19ad5d', '2021-10-06T11:16:00.000', true, 'link-nature');
-- Open Polkadot Identity locs
INSERT INTO loc_request (id, owner_address, requester_address, description, status, loc_type)
VALUES (md5(random()::text || clock_timestamp()::text)::uuid, '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', '5CXLTF2PFBE89tTYsrofGPkSfGTdmW4ciw4vAfgcKhjggRgZ', 'loc-11', 'OPEN', 'Identity');
INSERT INTO loc_request (id, owner_address, requester_address, description, status, loc_type)
VALUES (md5(random()::text || clock_timestamp()::text)::uuid, '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', '5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW', 'loc-12', 'OPEN', 'Identity');
INSERT INTO loc_request (id, owner_address, requester_address, description, status, loc_type)
VALUES (md5(random()::text || clock_timestamp()::text)::uuid, '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty', '5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW', 'loc-13', 'OPEN', 'Identity');
-- Open Logion Identity locs
INSERT INTO loc_request (id, owner_address, description, status, loc_type)
VALUES ('f5085ab0-e2ad-45f4-8b52-424f74cb9387', '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', 'loc-14', 'OPEN', 'Identity');
INSERT INTO loc_request (id, owner_address, description, status, loc_type)
VALUES ('7eb5b359-088b-4051-9507-fb66cf7d03aa', '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', 'loc-15', 'OPEN', 'Identity');
INSERT INTO loc_request (id, owner_address, description, status, loc_type)
VALUES ('518536e4-71e6-4c4f-82db-b16cbfb495ed', '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty', 'loc-16', 'OPEN', 'Identity');
-- Open Transaction locs linked to Logion Identity
INSERT INTO loc_request (id, requester_identity_loc, owner_address, description, status, loc_type)
VALUES ('f93bc0d2-f443-49ff-a9de-a6331167b267', 'f5085ab0-e2ad-45f4-8b52-424f74cb9387', '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', 'loc-17', 'OPEN', 'Transaction');
INSERT INTO loc_request (id, requester_identity_loc, owner_address, description, status, loc_type)
VALUES (md5(random()::text || clock_timestamp()::text)::uuid, '7eb5b359-088b-4051-9507-fb66cf7d03aa', '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', 'loc-18', 'OPEN', 'Transaction');
INSERT INTO loc_request (id, requester_identity_loc, owner_address, description, status, loc_type)
VALUES (md5(random()::text || clock_timestamp()::text)::uuid, '518536e4-71e6-4c4f-82db-b16cbfb495ed', '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty', 'loc-19', 'OPEN', 'Transaction');
-- Requested Collection locs
INSERT INTO loc_request (id, owner_address, requester_address, description, status, loc_type)
VALUES (md5(random()::text || clock_timestamp()::text)::uuid, '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', '5CXLTF2PFBE89tTYsrofGPkSfGTdmW4ciw4vAfgcKhjggRgZ', 'loc-21', 'REQUESTED', 'Collection');
INSERT INTO loc_request (id, owner_address, requester_address, description, status, loc_type)
VALUES (md5(random()::text || clock_timestamp()::text)::uuid, '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', '5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW', 'loc-22', 'REQUESTED', 'Collection');
INSERT INTO loc_request (id, owner_address, requester_address, description, status, loc_type)
VALUES (md5(random()::text || clock_timestamp()::text)::uuid, '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty', '5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW', 'loc-23', 'REQUESTED', 'Collection');
-- Open Collection locs
INSERT INTO loc_request (id, owner_address, requester_address, description, status, loc_type)
VALUES (md5(random()::text || clock_timestamp()::text)::uuid, '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', '5CXLTF2PFBE89tTYsrofGPkSfGTdmW4ciw4vAfgcKhjggRgZ', 'loc-24', 'OPEN', 'Collection');
INSERT INTO loc_request (id, owner_address, requester_address, description, status, loc_type)
VALUES (md5(random()::text || clock_timestamp()::text)::uuid, '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', '5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW', 'loc-25', 'OPEN', 'Collection');
INSERT INTO loc_request (id, owner_address, requester_address, description, status, loc_type)
VALUES (md5(random()::text || clock_timestamp()::text)::uuid, '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty', '5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW', 'loc-26', 'OPEN', 'Collection');
-- Closed Identity LOC of VTP
INSERT INTO loc_request (id, owner_address, requester_address, description, status, loc_type, verified_third_party)
VALUES ('15ed922d-5960-4147-a73f-97d362cb7c46', '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', '5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW', 'loc-27', 'CLOSED', 'Identity', TRUE);
INSERT INTO loc_request_file (request_id, hash, name, oid, content_type, added_on, "index", draft, nature, submitter, restricted_delivery)
VALUES ('15ed922d-5960-4147-a73f-97d362cb7c46', '0x1307990e6ba5ca145eb35e99182a9bec46531bc54ddf656a602c780fa0240dee', 'a file', 123456, 'text/plain', '2021-10-06T11:16:00.000', 0, TRUE, 'some nature', '5DDGQertEH5qvKVXUmpT3KNGViCX582Qa2WWb8nGbkmkRHvw', TRUE);
INSERT INTO loc_request_file_delivered (id, request_id, hash, delivered_file_hash, generated_on, owner)
VALUES (md5(random()::text || clock_timestamp()::text)::uuid, '15ed922d-5960-4147-a73f-97d362cb7c46', '0x1307990e6ba5ca145eb35e99182a9bec46531bc54ddf656a602c780fa0240dee', '0xf35e4bcbc1b0ce85af90914e04350cce472a2f01f00c0f7f8bc5c7ba04da2bf2', '2021-10-06T12:16:00.000', '5DDGQertEH5qvKVXUmpT3KNGViCX582Qa2WWb8nGbkmkRHvw');
INSERT INTO loc_request_file_delivered (id, request_id, hash, delivered_file_hash, generated_on, owner)
VALUES (md5(random()::text || clock_timestamp()::text)::uuid, '15ed922d-5960-4147-a73f-97d362cb7c46', '0x1307990e6ba5ca145eb35e99182a9bec46531bc54ddf656a602c780fa0240dee', '0x38df2378ed26e20124d8c38a945af1b4a058656aab3b3b1f71a9d8a629cc0d81', '2021-10-05T12:16:00.000', '5H9ZP7zyJtmay2Vcstf7SzK8LD1PGe5PJ8q7xakqp4zXFEwz');
INSERT INTO loc_request_file_delivered (id, request_id, hash, delivered_file_hash, generated_on, owner)
VALUES (md5(random()::text || clock_timestamp()::text)::uuid, '15ed922d-5960-4147-a73f-97d362cb7c46', '0x1307990e6ba5ca145eb35e99182a9bec46531bc54ddf656a602c780fa0240dee', '0xc14d46b478dcb21833b90dc9880aa3a7507b01aa5d033c64051df999f3c3bba0', '2021-10-07T12:16:00.000', '5Eewz58eEPS81847EezkiFENE3kG8fxrx1BdRWyFJAudPC6m');
