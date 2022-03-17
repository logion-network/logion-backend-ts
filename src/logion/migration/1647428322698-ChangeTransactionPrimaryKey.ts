import {MigrationInterface, QueryRunner} from "typeorm";

export class ChangeTransactionPrimaryKey1647428322698 implements MigrationInterface {
    name = 'ChangeTransactionPrimaryKey1647428322698'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transaction" ADD "id" uuid NOT NULL DEFAULT gen_random_uuid()`);
        await queryRunner.query(`ALTER TABLE "transaction" DROP CONSTRAINT "PK_transaction"`);
        await queryRunner.query(`ALTER TABLE "transaction" ADD CONSTRAINT "PK_transaction" PRIMARY KEY ("id")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transaction" DROP CONSTRAINT "PK_transaction"`);
        await queryRunner.query(`ALTER TABLE "transaction" ADD CONSTRAINT "PK_transaction" PRIMARY KEY ("block_number", "extrinsic_index")`);
        await queryRunner.query(`ALTER TABLE "transaction" DROP COLUMN "id"`);
    }

}
