import { MigrationInterface, QueryRunner } from "typeorm";

export class RecurrentFees1699278576170 implements MigrationInterface {
    name = 'RecurrentFees1699278576170'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "loc_link" DROP COLUMN "draft"`);
        await queryRunner.query(`ALTER TABLE "loc_request" ADD "collection_item_fee" numeric(50)`);
        await queryRunner.query(`ALTER TABLE "loc_request" ADD "tokens_record_fee" numeric(50)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "loc_request" DROP COLUMN "tokens_record_fee"`);
        await queryRunner.query(`ALTER TABLE "loc_request" DROP COLUMN "collection_item_fee"`);
        await queryRunner.query(`ALTER TABLE "loc_link" ADD "draft" boolean NOT NULL DEFAULT false`);
    }

}
