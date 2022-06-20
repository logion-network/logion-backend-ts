import {MigrationInterface, QueryRunner} from "typeorm";

export class DropProtectionUK1655475711956 implements MigrationInterface {
    name = 'DropProtectionUK1655475711956'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "protection_request" DROP CONSTRAINT "UQ_protection_request_requester_address"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "protection_request" ADD CONSTRAINT "UQ_protection_request_requester_address" UNIQUE ("requester_address")`);
    }

}
