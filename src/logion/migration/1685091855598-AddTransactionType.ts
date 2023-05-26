import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTransactionType1685091855598 implements MigrationInterface {
    name = 'AddTransactionType1685091855598'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transaction" ADD "type" character varying(255)`);
        await queryRunner.query(`UPDATE "transaction" SET "type" = 'VAULT_OUT' WHERE "inclusion_fee" = 0 AND "method" = 'transfer'`);
        await queryRunner.query(`UPDATE "transaction" SET "type" = 'STORAGE_FEE' WHERE "storage_fee" > 0`);
        await queryRunner.query(`UPDATE "transaction" SET "type" = 'EXTRINSIC' WHERE "type" IS NULL`);
        await queryRunner.query(`ALTER TABLE "transaction" ALTER COLUMN "type" SET NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transaction" DROP COLUMN "type"`);
    }

}
