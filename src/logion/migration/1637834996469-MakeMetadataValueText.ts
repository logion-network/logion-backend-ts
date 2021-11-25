import {MigrationInterface, QueryRunner} from "typeorm";

export class MakeMetadataValueText1637834996469 implements MigrationInterface {
    name = 'MakeMetadataValueText1637834996469'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."loc_metadata_item" ADD "value_text" text NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."loc_metadata_item" ALTER COLUMN "value" DROP NOT NULL`);
        await queryRunner.query(`UPDATE "public"."loc_metadata_item" SET "value_text" = "value"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."loc_metadata_item" ALTER COLUMN "value" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."loc_metadata_item" DROP COLUMN "value_text"`);
    }

}
