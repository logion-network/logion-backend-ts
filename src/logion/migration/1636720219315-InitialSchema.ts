import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1636720219315 implements MigrationInterface {
    name = 'InitialSchema1636720219315'

    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!await queryRunner.hasTable("loc_request")) {
            await queryRunner.query(`CREATE TABLE "loc_request"
                                     (
                                         "id"                uuid                   NOT NULL,
                                         "status"            character varying(255) NOT NULL,
                                         "requester_address" character varying(255) NOT NULL,
                                         "owner_address"     character varying(255) NOT NULL,
                                         "description"       character varying(255) NOT NULL,
                                         "loc_type"          character varying(255) NOT NULL,
                                         "decision_on"       TIMESTAMP,
                                         "reject_reason"     character varying(255),
                                         "created_on"        TIMESTAMP,
                                         "closed_on"         TIMESTAMP,
                                         "loc_created_on"    TIMESTAMP,
                                         "first_name"        character varying(255),
                                         "last_name"         character varying(255),
                                         "email"             character varying(255),
                                         "phone_number"      character varying(255),
                                         CONSTRAINT "PK_loc_request" PRIMARY KEY ("id")
                                     )`);
        }
        if (!await queryRunner.hasTable("loc_request_file")) {
            await queryRunner.query(`CREATE TABLE "loc_request_file"
                                     (
                                         "request_id"   uuid                   NOT NULL,
                                         "hash"         character varying      NOT NULL,
                                         "index"        integer                NOT NULL,
                                         "added_on"     TIMESTAMP,
                                         "name"         character varying(255) NOT NULL,
                                         "oid"          integer                NOT NULL,
                                         "content_type" character varying(255) NOT NULL,
                                         "draft"        boolean                NOT NULL,
                                         CONSTRAINT "PK_loc_request_file" PRIMARY KEY ("request_id", "hash", "index")
                                     )`);
            await queryRunner.query(`ALTER TABLE "loc_request_file"
                ADD CONSTRAINT "FK_loc_request_file_loc_request" FOREIGN KEY ("request_id") REFERENCES "loc_request" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        }
        if (!await queryRunner.hasTable("loc_metadata_item")) {
            await queryRunner.query(`CREATE TABLE "loc_metadata_item"
                                     (
                                         "request_id" uuid                   NOT NULL,
                                         "index"      integer                NOT NULL,
                                         "added_on"   TIMESTAMP,
                                         "name"       character varying(255) NOT NULL,
                                         "value"      character varying(255) NOT NULL,
                                         CONSTRAINT "PK_loc_metadata_item" PRIMARY KEY ("request_id", "index")
                                     )`);
            await queryRunner.query(`ALTER TABLE "loc_metadata_item"
                ADD CONSTRAINT "FK_loc_metadata_item_loc_request" FOREIGN KEY ("request_id") REFERENCES "loc_request" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        }
        if (!await queryRunner.hasTable("loc_link")) {
            await queryRunner.query(`CREATE TABLE "loc_link"
                                     (
                                         "request_id" uuid      NOT NULL,
                                         "index"      integer   NOT NULL,
                                         "added_on"   TIMESTAMP NOT NULL,
                                         "target"     uuid      NOT NULL,
                                         CONSTRAINT "PK_loc_link" PRIMARY KEY ("request_id", "index")
                                     )`);
            await queryRunner.query(`ALTER TABLE "loc_link"
                ADD CONSTRAINT "FK_loc_link_loc_request" FOREIGN KEY ("request_id") REFERENCES "loc_request" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        }
        if (!await queryRunner.hasTable("protection_request")) {
            await queryRunner.query(`CREATE TABLE "protection_request"
                                     (
                                         "id"                          uuid                   NOT NULL,
                                         "address_to_recover"          character varying(255),
                                         "created_on"                  TIMESTAMP,
                                         "is_recovery"                 boolean                NOT NULL,
                                         "requester_address"           character varying(255) NOT NULL,
                                         "email"                       character varying(255) NOT NULL,
                                         "first_name"                  character varying(255) NOT NULL,
                                         "last_name"                   character varying(255) NOT NULL,
                                         "phone_number"                character varying(255) NOT NULL,
                                         "city"                        character varying(255) NOT NULL,
                                         "country"                     character varying(255) NOT NULL,
                                         "line1"                       character varying(255) NOT NULL,
                                         "line2"                       character varying(255),
                                         "postal_code"                 character varying(255) NOT NULL,
                                         "status"                      character varying(255) NOT NULL,
                                         "other_legal_officer_address" character varying(255) NOT NULL,
                                         "decision_on"                 TIMESTAMP,
                                         "reject_reason"               character varying(255),
                                         "loc_id"                      uuid,
                                         CONSTRAINT "UQ_protection_request_requester_address" UNIQUE ("requester_address"),
                                         CONSTRAINT "PK_protection_request" PRIMARY KEY ("id")
                                     )`);
        }
        if (!await queryRunner.hasTable("session")) {
            await queryRunner.query(`CREATE TABLE "session"
                                     (
                                         "user_address" character varying(255) NOT NULL,
                                         "session_id"   uuid                   NOT NULL,
                                         "created_on"   TIMESTAMP,
                                         CONSTRAINT "PK_session" PRIMARY KEY ("user_address")
                                     )`);
        }
        if (!await queryRunner.hasTable("sync_point")) {
            await queryRunner.query(`CREATE TABLE "sync_point"
                                     (
                                         "name"                     character varying NOT NULL,
                                         "latest_head_block_number" bigint            NOT NULL,
                                         "updated_on"               TIMESTAMP         NOT NULL,
                                         CONSTRAINT "PK_sync_point" PRIMARY KEY ("name")
                                     )`);
        }
        if (!await queryRunner.hasTable("transaction")) {
            await queryRunner.query(`CREATE TABLE "transaction"
                                     (
                                         "block_number"    bigint                 NOT NULL,
                                         "extrinsic_index" integer                NOT NULL,
                                         "from_address"    character varying(255) NOT NULL,
                                         "to_address"      character varying(255),
                                         "transfer_value"  numeric(50)            NOT NULL,
                                         "tip"             numeric(50)            NOT NULL,
                                         "fee"             numeric(50)            NOT NULL,
                                         "reserved"        numeric(50)            NOT NULL,
                                         "pallet"          character varying      NOT NULL,
                                         "method"          character varying      NOT NULL,
                                         "created_on"      character varying      NOT NULL,
                                         CONSTRAINT "PK_transaction" PRIMARY KEY ("block_number", "extrinsic_index")
                                     )`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "transaction"`);
        await queryRunner.query(`DROP TABLE "sync_point"`);
        await queryRunner.query(`DROP TABLE "session"`);
        await queryRunner.query(`DROP TABLE "protection_request"`);
        await queryRunner.query(`DROP TABLE "loc_link"`);
        await queryRunner.query(`DROP TABLE "loc_metadata_item"`);
        await queryRunner.query(`DROP TABLE "loc_request_file"`);
        await queryRunner.query(`DROP TABLE "loc_request"`);
    }

}
