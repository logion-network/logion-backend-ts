INSERT INTO protection_request (id, requester_address, email, first_name, last_name, phone_number, city, country, line1, postal_code, is_recovery, status)
VALUES ('d9aea58aa7d24a768b74aff7b82380e1', '5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW', 'john.doe@logion.network', 'John', 'Doe', '+1234', 'Liège', 'Belgium', 'Place de le République Française', '4000', FALSE, 'PENDING');

INSERT INTO legal_officer_decision(legal_officer_address, status, request_id)
VALUES ('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', 'PENDING', 'd9aea58aa7d24a768b74aff7b82380e1'); -- ALICE

INSERT INTO legal_officer_decision(legal_officer_address, status, request_id)
VALUES ('5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty', 'ACCEPTED', 'd9aea58aa7d24a768b74aff7b82380e1'); -- BOB

INSERT INTO protection_request (id, requester_address, email, first_name, last_name, phone_number, city, country, line1, postal_code, is_recovery, status)
VALUES ('7ef13bcd867d487a8fc28c58143e0c43', '5CSbpCKSTvZefZYddesUQ9w6NDye2PHbf12MwBZGBgzGeGoo', 'john.doe@logion.network', 'John', 'Doe', '+1234', 'Liège', 'Belgium', 'Place de le République Française', '4000', FALSE, 'PENDING');

INSERT INTO legal_officer_decision(legal_officer_address, status, request_id)
VALUES ('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', 'ACCEPTED', '7ef13bcd867d487a8fc28c58143e0c43'); -- ALICE

INSERT INTO legal_officer_decision(legal_officer_address, status, request_id)
VALUES ('5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty', 'REJECTED', '7ef13bcd867d487a8fc28c58143e0c43'); -- BOB

INSERT INTO protection_request (id, requester_address, email, first_name, last_name, phone_number, city, country, line1, postal_code, is_recovery, status)
VALUES ('6ef13bcd867d487a8fc28c58143e0c44', '5EvPZRKRatcHusoKB467pDHcFTe3rG1a4eEhVmLxfirn8Cum', 'john.doe@logion.network', 'John', 'Doe', '+1234', 'Liège', 'Belgium', 'Place de le République Française', '4000', FALSE, 'PENDING');

INSERT INTO legal_officer_decision(legal_officer_address, status, request_id)
VALUES ('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', 'REJECTED', '6ef13bcd867d487a8fc28c58143e0c44'); -- ALICE

INSERT INTO legal_officer_decision(legal_officer_address, status, request_id)
VALUES ('5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty', 'ACCEPTED', '6ef13bcd867d487a8fc28c58143e0c44'); -- BOB

INSERT INTO protection_request (id, requester_address, email, first_name, last_name, phone_number, city, country, line1, postal_code, is_recovery, address_to_recover, status)
VALUES ('5926be94b2ba416a80fb069bd1e98845', '5EFHLCx7T6cHD75yjTcTV1KBSd9vbzXYVKweoReWbgVFSNhs', 'john.doe@logion.network', 'John', 'Doe', '+1234', 'Liège', 'Belgium', 'Place de le République Française', '4000', TRUE, '5EvPZRKRatcHusoKB467pDHcFTe3rG1a4eEhVmLxfirn8Cum', 'PENDING');

INSERT INTO legal_officer_decision(legal_officer_address, status, request_id)
VALUES ('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', 'REJECTED', '5926be94b2ba416a80fb069bd1e98845'); -- ALICE

INSERT INTO legal_officer_decision(legal_officer_address, status, request_id)
VALUES ('5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty', 'ACCEPTED', '5926be94b2ba416a80fb069bd1e98845'); -- BOB

INSERT INTO protection_request (id, requester_address, email, first_name, last_name, phone_number, city, country, line1, postal_code, is_recovery, status)
VALUES ('6ef13bcd867d487a8fc28c58143e0c45', '5GThAgk5q8fHoDymHuk7vPmbB9LsDK2BpK78GafB8kL2g8xp', 'john.doe@logion.network', 'John', 'Doe', '+1234', 'Liège', 'Belgium', 'Place de le République Française', '4000', FALSE, 'ACTIVATED');

INSERT INTO legal_officer_decision(legal_officer_address, status, request_id)
VALUES ('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', 'ACCEPTED', '6ef13bcd867d487a8fc28c58143e0c45'); -- ALICE

INSERT INTO legal_officer_decision(legal_officer_address, status, request_id)
VALUES ('5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty', 'ACCEPTED', '6ef13bcd867d487a8fc28c58143e0c45'); -- BOB
