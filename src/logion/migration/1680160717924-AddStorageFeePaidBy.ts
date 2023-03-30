import { MigrationInterface, QueryRunner } from "typeorm";

export class AddStorageFeePaidBy1680160717924 implements MigrationInterface {
    name = 'AddStorageFeePaidBy1680160717924'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "loc_request_file" ADD "storage_fee_paid_by" character varying(255)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "loc_request_file" DROP COLUMN "storage_fee_paid_by"`);
    }

}
