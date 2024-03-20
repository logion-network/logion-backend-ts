import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCollectionParams1710862720387 implements MigrationInterface {
    name = 'AddCollectionParams1710862720387'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "loc_request" ADD "collection_last_block_submission" bigint`);
        await queryRunner.query(`ALTER TABLE "loc_request" ADD "collection_max_size" integer`);
        await queryRunner.query(`ALTER TABLE "loc_request" ADD "collection_can_upload" boolean`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "loc_request" DROP COLUMN "collection_can_upload"`);
        await queryRunner.query(`ALTER TABLE "loc_request" DROP COLUMN "collection_max_size"`);
        await queryRunner.query(`ALTER TABLE "loc_request" DROP COLUMN "collection_last_block_submission"`);
    }

}
