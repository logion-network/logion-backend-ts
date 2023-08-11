import { MigrationInterface, QueryRunner } from "typeorm";

export class NullableLocFilePublicData1691675613366 implements MigrationInterface {
    name = 'NullableLocFilePublicData1691675613366'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "loc_metadata_item" DROP COLUMN "value"`);
        await queryRunner.query(`ALTER TABLE "loc_request_file" ALTER COLUMN "content_type" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "loc_metadata_item" ALTER COLUMN "value_text" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "loc_metadata_item" RENAME COLUMN "value_text" TO "value"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "loc_metadata_item" RENAME COLUMN "value" TO "value_text"`);
        await queryRunner.query(`ALTER TABLE "loc_metadata_item" ALTER COLUMN "value_text" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "loc_request_file" ALTER COLUMN "content_type" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "loc_metadata_item" ADD "value" character varying(255)`);
    }

}
