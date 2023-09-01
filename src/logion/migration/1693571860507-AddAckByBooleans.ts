import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAckByBooleans1693571860507 implements MigrationInterface {
    name = 'AddAckByBooleans1693571860507'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "loc_request_file" ADD "acknowledged_by_owner" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "loc_request_file" ADD "acknowledged_by_verified_issuer" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "loc_metadata_item" ADD "acknowledged_by_owner" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "loc_metadata_item" ADD "acknowledged_by_verified_issuer" boolean NOT NULL DEFAULT false`);

        await queryRunner.query(`UPDATE "loc_request_file" SET "acknowledged_by_owner" = "acknowledged_by_owner_on" IS NOT NULL`);
        await queryRunner.query(`UPDATE "loc_request_file" SET "acknowledged_by_verified_issuer" = "acknowledged_by_verified_issuer_on" IS NOT NULL`);

        await queryRunner.query(`UPDATE "loc_metadata_item" SET "acknowledged_by_owner" = "acknowledged_by_owner_on" IS NOT NULL`);
        await queryRunner.query(`UPDATE "loc_metadata_item" SET "acknowledged_by_verified_issuer" = "acknowledged_by_verified_issuer_on" IS NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "loc_metadata_item" DROP COLUMN "acknowledged_by_verified_issuer"`);
        await queryRunner.query(`ALTER TABLE "loc_metadata_item" DROP COLUMN "acknowledged_by_owner"`);
        await queryRunner.query(`ALTER TABLE "loc_request_file" DROP COLUMN "acknowledged_by_verified_issuer"`);
        await queryRunner.query(`ALTER TABLE "loc_request_file" DROP COLUMN "acknowledged_by_owner"`);
    }

}
