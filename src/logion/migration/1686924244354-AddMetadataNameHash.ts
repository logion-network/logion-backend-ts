import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMetadataNameHash1686924244354 implements MigrationInterface {
    name = 'AddMetadataNameHash1686924244354'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add and populate not null column "name_hash"
        await queryRunner.query(`ALTER TABLE "loc_metadata_item" ADD "name_hash" bytea NULL`);
        await queryRunner.query(`UPDATE "public"."loc_metadata_item" SET "name_hash" = sha256("name"::bytea)`);
        await queryRunner.query(`ALTER TABLE "loc_metadata_item" ALTER COLUMN "name_hash" SET NOT NULL`);
        // Re-create Primary Key
        await queryRunner.query(`ALTER TABLE "loc_metadata_item" DROP CONSTRAINT "PK_loc_metadata_item"`);
        await queryRunner.query(`ALTER TABLE "loc_metadata_item" ADD CONSTRAINT "PK_loc_metadata_item" PRIMARY KEY ("request_id", "name_hash")`);
        // Make "name" nullable
        await queryRunner.query(`ALTER TABLE "loc_metadata_item" ALTER COLUMN "name" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "loc_metadata_item" ALTER COLUMN "name" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "loc_metadata_item" DROP CONSTRAINT "PK_loc_metadata_item"`);
        await queryRunner.query(`ALTER TABLE "loc_metadata_item" ADD CONSTRAINT "PK_loc_metadata_item" PRIMARY KEY ("request_id", "name")`);
        await queryRunner.query(`ALTER TABLE "loc_metadata_item" DROP COLUMN "name_hash"`);
    }

}
