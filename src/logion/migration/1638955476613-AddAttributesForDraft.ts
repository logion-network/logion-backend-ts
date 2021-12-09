import {MigrationInterface, QueryRunner} from "typeorm";

export class AddAttributesForDraft1638955476613 implements MigrationInterface {
    name = 'AddAttributesForDraft1638955476613'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."loc_request_file" ADD "nature" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "public"."loc_metadata_item" ADD "draft" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "public"."loc_link" ADD "draft" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "public"."loc_link" ADD "nature" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "public"."loc_metadata_item" DROP CONSTRAINT "PK_loc_metadata_item"`);
        await queryRunner.query(`ALTER TABLE "public"."loc_metadata_item" ADD CONSTRAINT "PK_loc_metadata_item" PRIMARY KEY ("request_id", "name")`);
        await queryRunner.query(`ALTER TABLE "public"."loc_link" ALTER COLUMN "added_on" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."loc_link" DROP CONSTRAINT "PK_loc_link"`);
        await queryRunner.query(`ALTER TABLE "public"."loc_link" ADD CONSTRAINT "PK_loc_link" PRIMARY KEY ("request_id", "target")`);
        await queryRunner.query(`ALTER TABLE "public"."loc_metadata_item" ADD CONSTRAINT "UQ_loc_metadata_item_request_id_index" UNIQUE ("request_id", "index")`);
        await queryRunner.query(`ALTER TABLE "public"."loc_link" ADD CONSTRAINT "UQ_loc_link_request_id_index" UNIQUE ("request_id", "index")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."loc_link" DROP CONSTRAINT "UQ_loc_link_request_id_index"`);
        await queryRunner.query(`ALTER TABLE "public"."loc_metadata_item" DROP CONSTRAINT "UQ_loc_metadata_item_request_id_index"`);
        await queryRunner.query(`ALTER TABLE "public"."loc_link" ALTER COLUMN "added_on" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."loc_link" DROP CONSTRAINT "PK_loc_link"`);
        await queryRunner.query(`ALTER TABLE "public"."loc_link" ADD CONSTRAINT "PK_loc_link" PRIMARY KEY ("request_id", "index")`);
        await queryRunner.query(`ALTER TABLE "public"."loc_metadata_item" DROP CONSTRAINT "PK_loc_metadata_item"`);
        await queryRunner.query(`ALTER TABLE "public"."loc_metadata_item" ADD CONSTRAINT "PK_loc_metadata_item" PRIMARY KEY ("request_id", "index")`);
        await queryRunner.query(`ALTER TABLE "public"."loc_link" DROP COLUMN "nature"`);
        await queryRunner.query(`ALTER TABLE "public"."loc_link" DROP COLUMN "draft"`);
        await queryRunner.query(`ALTER TABLE "public"."loc_metadata_item" DROP COLUMN "draft"`);
        await queryRunner.query(`ALTER TABLE "public"."loc_request_file" DROP COLUMN "nature"`);
    }

}
