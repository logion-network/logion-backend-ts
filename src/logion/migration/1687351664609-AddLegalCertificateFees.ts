import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLegalCertificateFees1687351664609 implements MigrationInterface {
    name = 'AddLegalCertificateFees1687351664609'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transaction" ADD "legal_fee" numeric(50)`);
        await queryRunner.query(`ALTER TABLE "transaction" ADD "certificate_fee" numeric(50)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transaction" DROP COLUMN "certificate_fee"`);
        await queryRunner.query(`ALTER TABLE "transaction" DROP COLUMN "legal_fee"`);
    }

}
