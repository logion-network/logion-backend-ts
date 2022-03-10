INSERT INTO vault_transfer_request (id, created_on, requester_address, destination, amount, block_number, extrinsic_index, status)
VALUES ('d9aea58aa7d24a768b74aff7b82380e1', '2021-10-29T11:47:00.000', '5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW', '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty', '1000', '4242', 42, 'PENDING');

INSERT INTO vault_transfer_request (id, created_on, requester_address, destination, amount, block_number, extrinsic_index, status, decision_on)
VALUES ('7ef13bcd867d487a8fc28c58143e0c43', '2021-10-29T11:47:00.000', '5CSbpCKSTvZefZYddesUQ9w6NDye2PHbf12MwBZGBgzGeGoo', '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty', '1000', '4243', 42, 'ACCEPTED', '2021-10-29T11:47:00.000');

INSERT INTO vault_transfer_request (id, created_on, requester_address, destination, amount, block_number, extrinsic_index, status, decision_on, reject_reason)
VALUES ('6ef13bcd867d487a8fc28c58143e0c44', '2021-10-29T11:47:00.000', '5EvPZRKRatcHusoKB467pDHcFTe3rG1a4eEhVmLxfirn8Cum', '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty', '1000', '4244', 42, 'REJECTED', '2021-10-29T11:47:00.000', 'Because.');
