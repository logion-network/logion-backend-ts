INSERT INTO protection_request (id, requester_address, email, first_name, last_name, phone_number, city, country, line1, postal_code, is_recovery, status)
VALUES ('d9aea58aa7d24a768b74aff7b82380e1', '5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW', 'john.doe@logion.network', 'John', 'Doe', '+1234', 'Liège', 'Belgium', 'Place de le République Française', '4000', FALSE, 'PENDING');

INSERT INTO protection_request (id, requester_address, email, first_name, last_name, phone_number, city, country, line1, postal_code, is_recovery, status, decision_on, loc_id)
VALUES ('7ef13bcd867d487a8fc28c58143e0c43', '5CSbpCKSTvZefZYddesUQ9w6NDye2PHbf12MwBZGBgzGeGoo', 'john.doe@logion.network', 'John', 'Doe', '+1234', 'Liège', 'Belgium', 'Place de le République Française', '4000', FALSE, 'ACCEPTED', '2021-10-29T11:47:00.000', '7ef13bcd867d487a8fc28c58143e0c43');

INSERT INTO protection_request (id, requester_address, email, first_name, last_name, phone_number, city, country, line1, postal_code, is_recovery, status, decision_on, reject_reason)
VALUES ('6ef13bcd867d487a8fc28c58143e0c44', '5EvPZRKRatcHusoKB467pDHcFTe3rG1a4eEhVmLxfirn8Cum', 'john.doe@logion.network', 'John', 'Doe', '+1234', 'Liège', 'Belgium', 'Place de le République Française', '4000', FALSE, 'REJECTED', '2021-10-29T11:47:00.000', 'Because.');

INSERT INTO protection_request (id, requester_address, email, first_name, last_name, phone_number, city, country, line1, postal_code, is_recovery, address_to_recover, status, decision_on, reject_reason)
VALUES ('5926be94b2ba416a80fb069bd1e98845', '5EFHLCx7T6cHD75yjTcTV1KBSd9vbzXYVKweoReWbgVFSNhs', 'john.doe@logion.network', 'John', 'Doe', '+1234', 'Liège', 'Belgium', 'Place de le République Française', '4000', TRUE, '5EvPZRKRatcHusoKB467pDHcFTe3rG1a4eEhVmLxfirn8Cum', 'REJECTED', '2021-10-29T11:47:00.000', 'Because.');

INSERT INTO protection_request (id, requester_address, email, first_name, last_name, phone_number, city, country, line1, postal_code, is_recovery, status, decision_on, loc_id)
VALUES ('6ef13bcd867d487a8fc28c58143e0c45', '5GThAgk5q8fHoDymHuk7vPmbB9LsDK2BpK78GafB8kL2g8xp', 'john.doe@logion.network', 'John', 'Doe', '+1234', 'Liège', 'Belgium', 'Place de le République Française', '4000', FALSE, 'ACTIVATED', '2021-10-29T11:47:00.000', '6ef13bcd867d487a8fc28c58143e0c45');
