import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLocItemsFees1680084715278 implements MigrationInterface {
    name = 'AddLocItemsFees1680084715278'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "loc_request_file" ADD "inclusion_fee" numeric(50)`);
        await queryRunner.query(`ALTER TABLE "loc_request_file" ADD "storage_fee" numeric(50)`);
        await queryRunner.query(`ALTER TABLE "loc_metadata_item" ADD "inclusion_fee" numeric(50)`);
        await queryRunner.query(`ALTER TABLE "loc_link" ADD "inclusion_fee" numeric(50)`);
        await queryRunner.query(`ALTER TABLE "transaction" ALTER COLUMN "inclusion_fee" TYPE numeric(50)`);
        await queryRunner.query(`ALTER TABLE "transaction" ALTER COLUMN "inclusion_fee" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transaction" ALTER COLUMN "inclusion_fee" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "transaction" ALTER COLUMN "inclusion_fee" TYPE numeric(50,0)`);
        await queryRunner.query(`ALTER TABLE "loc_link" DROP COLUMN "inclusion_fee"`);
        await queryRunner.query(`ALTER TABLE "loc_metadata_item" DROP COLUMN "inclusion_fee"`);
        await queryRunner.query(`ALTER TABLE "loc_request_file" DROP COLUMN "storage_fee"`);
        await queryRunner.query(`ALTER TABLE "loc_request_file" DROP COLUMN "inclusion_fee"`);
    }

}
