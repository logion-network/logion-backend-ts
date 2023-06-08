import { MigrationInterface, QueryRunner } from "typeorm";

export class DropDraft1686211213240 implements MigrationInterface {
    name = 'DropDraft1686211213240'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "loc_request_file" DROP COLUMN "draft"`);
        await queryRunner.query(`ALTER TABLE "loc_metadata_item" DROP COLUMN "draft"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "loc_metadata_item" ADD "draft" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "loc_request_file" ADD "draft" boolean NOT NULL DEFAULT true`);
    }

}
