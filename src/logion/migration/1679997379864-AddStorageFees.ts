import { MigrationInterface, QueryRunner } from "typeorm";

export class AddStorageFees1679997379864 implements MigrationInterface {
    name = 'AddStorageFees1679997379864'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "loc_request" DROP COLUMN "verified_third_party"`);
        await queryRunner.query(`ALTER TABLE "transaction" ADD "storage_fee" numeric(50)`);
        await queryRunner.query(`ALTER TABLE "transaction" RENAME "fee" TO "inclusion_fee" `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transaction" RENAME "inclusion_fee" TO "fee" `);
        await queryRunner.query(`ALTER TABLE "transaction" DROP COLUMN "storage_fee"`);
        await queryRunner.query(`ALTER TABLE "loc_request" ADD "verified_third_party" boolean NOT NULL DEFAULT false`);
    }

}
