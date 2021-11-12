import {MigrationInterface, QueryRunner} from "typeorm";

export class TransactionErrors1637061269576 implements MigrationInterface {
    name = 'TransactionErrors1637061269576'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."loc_request_file" DROP CONSTRAINT "FK_loc_request_file_loc_request"`);
        await queryRunner.query(`ALTER TABLE "public"."loc_metadata_item" DROP CONSTRAINT "FK_loc_metadata_item_loc_request"`);
        await queryRunner.query(`ALTER TABLE "public"."loc_link" DROP CONSTRAINT "FK_loc_link_loc_request"`);
        await queryRunner.query(`ALTER TABLE "public"."transaction" ADD "successful" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "public"."transaction" ADD "error_section" character varying`);
        await queryRunner.query(`ALTER TABLE "public"."transaction" ADD "error_name" character varying`);
        await queryRunner.query(`ALTER TABLE "public"."transaction" ADD "error_details" character varying`);
        await queryRunner.query(`ALTER TABLE "public"."loc_request_file" ADD CONSTRAINT "FK_loc_request_file_request_id" FOREIGN KEY ("request_id") REFERENCES "loc_request"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "public"."loc_metadata_item" ADD CONSTRAINT "FK_loc_metadata_item_request_id" FOREIGN KEY ("request_id") REFERENCES "loc_request"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "public"."loc_link" ADD CONSTRAINT "FK_loc_link_request_id" FOREIGN KEY ("request_id") REFERENCES "loc_request"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."loc_link" DROP CONSTRAINT "FK_loc_link_request_id"`);
        await queryRunner.query(`ALTER TABLE "public"."loc_metadata_item" DROP CONSTRAINT "FK_loc_metadata_item_request_id"`);
        await queryRunner.query(`ALTER TABLE "public"."loc_request_file" DROP CONSTRAINT "FK_loc_request_file_request_id"`);
        await queryRunner.query(`ALTER TABLE "public"."transaction" DROP COLUMN "error_details"`);
        await queryRunner.query(`ALTER TABLE "public"."transaction" DROP COLUMN "error_name"`);
        await queryRunner.query(`ALTER TABLE "public"."transaction" DROP COLUMN "error_section"`);
        await queryRunner.query(`ALTER TABLE "public"."transaction" DROP COLUMN "successful"`);
        await queryRunner.query(`ALTER TABLE "public"."loc_link" ADD CONSTRAINT "FK_loc_link_loc_request" FOREIGN KEY ("request_id") REFERENCES "loc_request"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "public"."loc_metadata_item" ADD CONSTRAINT "FK_loc_metadata_item_loc_request" FOREIGN KEY ("request_id") REFERENCES "loc_request"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "public"."loc_request_file" ADD CONSTRAINT "FK_loc_request_file_loc_request" FOREIGN KEY ("request_id") REFERENCES "loc_request"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
