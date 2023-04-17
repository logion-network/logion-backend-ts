import { MigrationInterface, QueryRunner } from "typeorm";

export class AddItemSubmitterType1681743107271 implements MigrationInterface {
    name = 'AddItemSubmitterType1681743107271'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "loc_request_file" RENAME COLUMN "submitter" TO "submitter_address"`);
        await queryRunner.query(`ALTER TABLE "loc_metadata_item" RENAME COLUMN "submitter" TO "submitter_address"`);

        await queryRunner.query(`ALTER TABLE "loc_request_file" ADD "submitter_address_type" character varying(255)`);
        await queryRunner.query(`UPDATE "loc_request_file" SET "submitter_address_type" = 'Polkadot'`);
        await queryRunner.query(`ALTER TABLE "loc_request_file" ALTER COLUMN "submitter_address_type" SET NOT NULL`);

        await queryRunner.query(`ALTER TABLE "loc_metadata_item" ADD "submitter_address_type" character varying(255)`);
        await queryRunner.query(`UPDATE "loc_metadata_item" SET "submitter_address_type" = 'Polkadot'`);
        await queryRunner.query(`ALTER TABLE "loc_metadata_item" ALTER COLUMN "submitter_address_type" SET NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "loc_metadata_item" DROP COLUMN "submitter_address_type"`);
        await queryRunner.query(`ALTER TABLE "loc_request_file" DROP COLUMN "submitter_address_type"`);
        await queryRunner.query(`ALTER TABLE "loc_metadata_item" RENAME COLUMN "submitter_address" TO "submitter"`);
        await queryRunner.query(`ALTER TABLE "loc_request_file" RENAME COLUMN "submitter_address" TO "submitter"`);
    }

}
