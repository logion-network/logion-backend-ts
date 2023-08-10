import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLegalFees1691656359969 implements MigrationInterface {
    name = 'AddLegalFees1691656359969'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transaction" ADD "value_fee" numeric(50)`);
        await queryRunner.query(`ALTER TABLE "loc_request" ADD "value_fee" numeric(50)`);
        await queryRunner.query(`UPDATE "loc_request" SET "value_fee" = 0 WHERE "loc_type" = 'Collection'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "loc_request" DROP COLUMN "value_fee"`);
        await queryRunner.query(`ALTER TABLE "transaction" DROP COLUMN "value_fee"`);
    }

}
