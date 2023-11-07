import { MigrationInterface, QueryRunner } from "typeorm";

export class RecurrentFeesSync1699367343651 implements MigrationInterface {
    name = 'RecurrentFeesSync1699367343651'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transaction" ADD "collection_item_fee" numeric(50)`);
        await queryRunner.query(`ALTER TABLE "transaction" ADD "tokens_record_fee" numeric(50)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transaction" DROP COLUMN "tokens_record_fee"`);
        await queryRunner.query(`ALTER TABLE "transaction" DROP COLUMN "collection_item_fee"`);
    }

}
