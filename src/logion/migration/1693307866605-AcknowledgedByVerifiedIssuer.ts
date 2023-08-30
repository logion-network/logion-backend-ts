import { MigrationInterface, QueryRunner } from "typeorm";

export class AcknowledgedByVerifiedIssuer1693307866605 implements MigrationInterface {
    name = 'AcknowledgedByVerifiedIssuer1693307866605'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "loc_request_file" RENAME COLUMN "acknowledged_on" TO "acknowledged_by_owner_on"`);
        await queryRunner.query(`ALTER TABLE "loc_metadata_item" RENAME COLUMN "acknowledged_on" TO "acknowledged_by_owner_on"`);
        await queryRunner.query(`ALTER TABLE "loc_request_file" ADD "acknowledged_by_verified_issuer_on" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "loc_metadata_item" ADD "acknowledged_by_verified_issuer_on" TIMESTAMP`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "loc_metadata_item" DROP COLUMN "acknowledged_by_verified_issuer_on"`);
        await queryRunner.query(`ALTER TABLE "loc_request_file" DROP COLUMN "acknowledged_by_verified_issuer_on"`);
        await queryRunner.query(`ALTER TABLE "loc_metadata_item" RENAME COLUMN "acknowledged_by_owner_on" TO "acknowledged_on"`);
        await queryRunner.query(`ALTER TABLE "loc_request_file" RENAME COLUMN "acknowledged_by_owner_on" TO "acknowledged_on"`);
    }

}
