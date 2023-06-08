import { MigrationInterface, QueryRunner } from "typeorm";

export class DropDraft1686234465150 implements MigrationInterface {
    name = 'DropDraft1686234465150'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "loc_request_file" DROP COLUMN IF EXISTS "draft"`);
        await queryRunner.query(`ALTER TABLE "loc_metadata_item" DROP COLUMN IF EXISTS "draft"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "loc_metadata_item" ADD "draft" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "loc_request_file" ADD "draft" boolean NOT NULL DEFAULT true`);
    }

}
