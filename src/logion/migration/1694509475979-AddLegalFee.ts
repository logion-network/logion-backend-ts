import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLegalFee1694509475979 implements MigrationInterface {
    name = 'AddLegalFee1694509475979'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "loc_request" ADD "legal_fee" numeric(50)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "loc_request" DROP COLUMN "legal_fee"`);
    }

}
