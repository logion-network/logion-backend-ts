INSERT INTO protection_request (id, requester_address, legal_officer_address, other_legal_officer_address, requester_identity_loc_id, is_recovery, status)
VALUES ('d9aea58aa7d24a768b74aff7b82380e1', '5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW', '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty', 'b826df54-6d31-4dd0-99af-e89e81890143', FALSE, 'PENDING');

INSERT INTO protection_request (id, requester_address, legal_officer_address, other_legal_officer_address, requester_identity_loc_id, is_recovery, status, decision_on)
VALUES ('7ef13bcd867d487a8fc28c58143e0c43', '5CSbpCKSTvZefZYddesUQ9w6NDye2PHbf12MwBZGBgzGeGoo', '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty', 'b826df54-6d31-4dd0-99af-e89e81890143', FALSE, 'ACCEPTED', '2021-10-29T11:47:00.000');

INSERT INTO protection_request (id, requester_address, legal_officer_address, other_legal_officer_address, requester_identity_loc_id, is_recovery, status, decision_on, reject_reason)
VALUES ('6ef13bcd867d487a8fc28c58143e0c44', '5EvPZRKRatcHusoKB467pDHcFTe3rG1a4eEhVmLxfirn8Cum', '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty', 'b826df54-6d31-4dd0-99af-e89e81890143', FALSE, 'REJECTED', '2021-10-29T11:47:00.000', 'Because.');

INSERT INTO protection_request (id, requester_address, legal_officer_address, other_legal_officer_address, requester_identity_loc_id, is_recovery, address_to_recover, status, decision_on, reject_reason)
VALUES ('5926be94b2ba416a80fb069bd1e98845', '5EFHLCx7T6cHD75yjTcTV1KBSd9vbzXYVKweoReWbgVFSNhs', '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty', 'b826df54-6d31-4dd0-99af-e89e81890143', TRUE, '5EvPZRKRatcHusoKB467pDHcFTe3rG1a4eEhVmLxfirn8Cum', 'REJECTED', '2021-10-29T11:47:00.000', 'Because.');

INSERT INTO protection_request (id, requester_address, legal_officer_address, other_legal_officer_address, requester_identity_loc_id, is_recovery, status, decision_on)
VALUES ('6ef13bcd867d487a8fc28c58143e0c45', '5GThAgk5q8fHoDymHuk7vPmbB9LsDK2BpK78GafB8kL2g8xp', '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty', 'b826df54-6d31-4dd0-99af-e89e81890143', FALSE, 'ACTIVATED', '2021-10-29T11:47:00.000');
