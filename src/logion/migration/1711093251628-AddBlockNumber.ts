import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBlockNumber1711093251628 implements MigrationInterface {
    name = 'AddBlockNumber1711093251628'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sync_point" RENAME COLUMN "latest_head_block_number" TO "block_number"`);

        await queryRunner.query(`ALTER TABLE "sync_point" ADD "chain_type" character varying(4)`);
        await queryRunner.query(`UPDATE      "sync_point" SET "chain_type" = 'Solo'`);
        await queryRunner.query(`ALTER TABLE "sync_point" ALTER COLUMN "chain_type" SET NOT NULL`);

        await queryRunner.query(`ALTER TABLE "transaction" ADD "chain_type" character varying(4)`);
        await queryRunner.query(`UPDATE      "transaction" SET "chain_type" = 'Solo'`);
        await queryRunner.query(`ALTER TABLE "transaction" ALTER COLUMN "chain_type" SET NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transaction" DROP COLUMN "chain_type"`);
        await queryRunner.query(`ALTER TABLE "sync_point" DROP COLUMN "chain_type"`);
        await queryRunner.query(`ALTER TABLE "sync_point" RENAME COLUMN "block_number" TO "latest_head_block_number"`);
    }

}
