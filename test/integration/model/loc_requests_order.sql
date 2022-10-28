INSERT INTO loc_request (id, owner_address, requester_address, description, loc_type, status, created_on, decision_on, loc_created_on, closed_on, voided_on)
VALUES (md5(random()::text || clock_timestamp()::text)::uuid, '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', '5CXLTF2PFBE89tTYsrofGPkSfGTdmW4ciw4vAfgcKhjggRgZ',
        'ordered-loc-1', 'Transaction', 'REQUESTED', '2022-10-01', null, null, null, null);
INSERT INTO loc_request (id, owner_address, requester_address, description, loc_type, status, created_on, decision_on, loc_created_on, closed_on, voided_on)
VALUES (md5(random()::text || clock_timestamp()::text)::uuid, '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', '5CXLTF2PFBE89tTYsrofGPkSfGTdmW4ciw4vAfgcKhjggRgZ',
        'ordered-loc-2', 'Transaction', 'REQUESTED', '2022-10-02', null, null, null, null);
INSERT INTO loc_request (id, owner_address, requester_address, description, loc_type, status, created_on, decision_on, loc_created_on, closed_on, voided_on)
VALUES (md5(random()::text || clock_timestamp()::text)::uuid, '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', '5CXLTF2PFBE89tTYsrofGPkSfGTdmW4ciw4vAfgcKhjggRgZ',
        'ordered-loc-9', 'Transaction', 'REJECTED', '2022-10-01', '2022-10-02', null, null, null);
INSERT INTO loc_request (id, owner_address, requester_address, description, loc_type, status, created_on, decision_on, loc_created_on, closed_on, voided_on)
VALUES (md5(random()::text || clock_timestamp()::text)::uuid, '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', '5CXLTF2PFBE89tTYsrofGPkSfGTdmW4ciw4vAfgcKhjggRgZ',
        'ordered-loc-10', 'Transaction', 'REJECTED', '2022-10-02', '2022-10-03', null, null, null);
INSERT INTO loc_request (id, owner_address, requester_address, description, loc_type, status, created_on, decision_on, loc_created_on, closed_on, voided_on)
VALUES (md5(random()::text || clock_timestamp()::text)::uuid, '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', '5CXLTF2PFBE89tTYsrofGPkSfGTdmW4ciw4vAfgcKhjggRgZ',
        'ordered-loc-3', 'Transaction', 'OPEN', '2022-10-01', '2022-10-02', '2022-10-03', null, null);
INSERT INTO loc_request (id, owner_address, requester_address, description, loc_type, status, created_on, decision_on, loc_created_on, closed_on, voided_on)
VALUES (md5(random()::text || clock_timestamp()::text)::uuid, '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', '5CXLTF2PFBE89tTYsrofGPkSfGTdmW4ciw4vAfgcKhjggRgZ',
        'ordered-loc-4', 'Transaction', 'OPEN', '2022-10-02', '2022-10-03', '2022-10-04', null, null);
INSERT INTO loc_request (id, owner_address, requester_address, description, loc_type, status, created_on, decision_on, loc_created_on, closed_on, voided_on)
VALUES (md5(random()::text || clock_timestamp()::text)::uuid, '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', '5CXLTF2PFBE89tTYsrofGPkSfGTdmW4ciw4vAfgcKhjggRgZ',
        'ordered-loc-5', 'Transaction', 'CLOSED', '2022-10-01', '2022-10-02', '2022-10-03', '2022-10-04', null);
INSERT INTO loc_request (id, owner_address, requester_address, description, loc_type, status, created_on, decision_on, loc_created_on, closed_on, voided_on)
VALUES (md5(random()::text || clock_timestamp()::text)::uuid, '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', '5CXLTF2PFBE89tTYsrofGPkSfGTdmW4ciw4vAfgcKhjggRgZ',
        'ordered-loc-6', 'Transaction', 'CLOSED', '2022-10-02', '2022-10-03', '2022-10-04', '2022-10-05', null);
INSERT INTO loc_request (id, owner_address, requester_address, description, loc_type, status, created_on, decision_on, loc_created_on, closed_on, voided_on)
VALUES (md5(random()::text || clock_timestamp()::text)::uuid, '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', '5CXLTF2PFBE89tTYsrofGPkSfGTdmW4ciw4vAfgcKhjggRgZ',
        'ordered-loc-7', 'Transaction', 'CLOSED', '2022-10-01', '2022-10-02', '2022-10-03', '2022-10-04', '2022-10-05'); -- VOID
INSERT INTO loc_request (id, owner_address, requester_address, description, loc_type, status, created_on, decision_on, loc_created_on, closed_on, voided_on)
VALUES (md5(random()::text || clock_timestamp()::text)::uuid, '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', '5CXLTF2PFBE89tTYsrofGPkSfGTdmW4ciw4vAfgcKhjggRgZ',
        'ordered-loc-8', 'Transaction', 'CLOSED', '2022-10-02', '2022-10-03', '2022-10-04', '2022-10-05', '2022-10-06'); -- VOID
