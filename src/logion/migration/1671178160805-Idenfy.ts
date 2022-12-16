import { MigrationInterface, QueryRunner } from "typeorm";

export class Idenfy1671178160805 implements MigrationInterface {
    name = 'Idenfy1671178160805'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "loc_request" ADD "idenfy_auth_token" character varying(40)`);
        await queryRunner.query(`ALTER TABLE "loc_request" ADD "idenfy_scan_ref" character varying(40)`);
        await queryRunner.query(`ALTER TABLE "loc_request" ADD "idenfy_status" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "loc_request" ADD "idenfy_callback_payload" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "loc_request" DROP COLUMN "idenfy_callback_payload"`);
        await queryRunner.query(`ALTER TABLE "loc_request" DROP COLUMN "idenfy_status"`);
        await queryRunner.query(`ALTER TABLE "loc_request" DROP COLUMN "idenfy_scan_ref"`);
        await queryRunner.query(`ALTER TABLE "loc_request" DROP COLUMN "idenfy_auth_token"`);
    }

}
