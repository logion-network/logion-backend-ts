import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCompany1666083444245 implements MigrationInterface {
    name = 'AddCompany1666083444245'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "loc_request" ADD "company" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "loc_request" ADD "seal_version" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "protection_request" ALTER COLUMN "first_name" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "protection_request" ALTER COLUMN "last_name" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "protection_request" ALTER COLUMN "email" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "protection_request" ALTER COLUMN "phone_number" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "protection_request" ALTER COLUMN "line1" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "protection_request" ALTER COLUMN "postal_code" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "protection_request" ALTER COLUMN "city" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "protection_request" ALTER COLUMN "country" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "protection_request" ALTER COLUMN "country" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "protection_request" ALTER COLUMN "city" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "protection_request" ALTER COLUMN "postal_code" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "protection_request" ALTER COLUMN "line1" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "protection_request" ALTER COLUMN "phone_number" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "protection_request" ALTER COLUMN "email" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "protection_request" ALTER COLUMN "last_name" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "protection_request" ALTER COLUMN "first_name" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "loc_request" DROP COLUMN "seal_version"`);
        await queryRunner.query(`ALTER TABLE "loc_request" DROP COLUMN "company"`);
    }

}
