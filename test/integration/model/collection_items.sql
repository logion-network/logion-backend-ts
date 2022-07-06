INSERT INTO collection_item(collection_loc_id, item_id, added_on)
VALUES ('2035224b-ef77-4a69-aac4-e74bd030675d', '0x1307990e6ba5ca145eb35e99182a9bec46531bc54ddf656a602c780fa0240dee', '2022-02-16T18:28:42.000000');

INSERT INTO collection_item(collection_loc_id, item_id, added_on)
VALUES ('296d3d8f-057f-445c-b4c8-59aa7d2d21de', '0x1307990e6ba5ca145eb35e99182a9bec46531bc54ddf656a602c780fa0240dee', '2022-02-16T18:28:42.000000');

INSERT INTO collection_item_file(collection_loc_id, item_id, hash, cid)
VALUES ('296d3d8f-057f-445c-b4c8-59aa7d2d21de', '0x1307990e6ba5ca145eb35e99182a9bec46531bc54ddf656a602c780fa0240dee', '0x979ff1da4670561bf3f521a1a1d4aad097d617d2fa2c0e75d52efe90e7b7ce83', 123456);

INSERT INTO collection_item_file(collection_loc_id, item_id, hash, cid)
VALUES ('296d3d8f-057f-445c-b4c8-59aa7d2d21de', '0x1307990e6ba5ca145eb35e99182a9bec46531bc54ddf656a602c780fa0240dee', '0x8bd8548beac4ce719151dc2ae893f8edc658a566e5ff654104783e14fb44012e', 78910);

INSERT INTO collection_item(collection_loc_id, item_id, added_on)
VALUES ('c38e5ab8-785f-4e26-91bd-f9cdef82f601', '0x1307990e6ba5ca145eb35e99182a9bec46531bc54ddf656a602c780fa0240dee', '2022-02-16T18:28:42.000000');

-- Not yet synced
INSERT INTO collection_item(collection_loc_id, item_id)
VALUES ('52d29fe9-983f-44d2-9e23-c8cb542981a3', '0x1307990e6ba5ca145eb35e99182a9bec46531bc54ddf656a602c780fa0240dee');

INSERT INTO collection_item_file(collection_loc_id, item_id, hash, cid)
VALUES ('52d29fe9-983f-44d2-9e23-c8cb542981a3', '0x1307990e6ba5ca145eb35e99182a9bec46531bc54ddf656a602c780fa0240dee', '0x979ff1da4670561bf3f521a1a1d4aad097d617d2fa2c0e75d52efe90e7b7ce83', 123456);

INSERT INTO collection_item_file(collection_loc_id, item_id, hash, cid)
VALUES ('52d29fe9-983f-44d2-9e23-c8cb542981a3', '0x1307990e6ba5ca145eb35e99182a9bec46531bc54ddf656a602c780fa0240dee', '0x8bd8548beac4ce719151dc2ae893f8edc658a566e5ff654104783e14fb44012e', 78910);

-- Synced but no files yet
INSERT INTO collection_item(collection_loc_id, item_id, added_on)
VALUES ('f14c0bd4-9ed1-4c46-9b42-47c63e09223f', '0x1307990e6ba5ca145eb35e99182a9bec46531bc54ddf656a602c780fa0240dee', '2022-01-01T18:28:42.000000');
