import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRequesterAddressType1680855417833 implements MigrationInterface {
    name = 'AddRequesterAddressType1680855417833'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "loc_request" ADD "requester_address_type" character varying(255)`);
        await queryRunner.query(`UPDATE "loc_request" SET "requester_address_type" = 'Polkadot' WHERE "requester_address" IS NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "loc_request" DROP COLUMN "requester_address_type"`);
    }

}
