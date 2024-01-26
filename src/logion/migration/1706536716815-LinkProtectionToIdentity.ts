import { MigrationInterface, QueryRunner } from "typeorm";

export class LinkProtectionToIdentity1706536716815 implements MigrationInterface {
    name = 'LinkProtectionToIdentity1706536716815'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "protection_request" DROP COLUMN "postal_code"`);
        await queryRunner.query(`ALTER TABLE "protection_request" DROP COLUMN "line2"`);
        await queryRunner.query(`ALTER TABLE "protection_request" DROP COLUMN "line1"`);
        await queryRunner.query(`ALTER TABLE "protection_request" DROP COLUMN "country"`);
        await queryRunner.query(`ALTER TABLE "protection_request" DROP COLUMN "city"`);
        await queryRunner.query(`ALTER TABLE "protection_request" DROP COLUMN "phone_number"`);
        await queryRunner.query(`ALTER TABLE "protection_request" DROP COLUMN "last_name"`);
        await queryRunner.query(`ALTER TABLE "protection_request" DROP COLUMN "first_name"`);
        await queryRunner.query(`ALTER TABLE "protection_request" DROP COLUMN "email"`);
        await queryRunner.query(`ALTER TABLE "protection_request" ADD "requester_identity_loc_id" uuid NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "protection_request" DROP COLUMN "requester_identity_loc_id"`);
        await queryRunner.query(`ALTER TABLE "protection_request" ADD "email" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "protection_request" ADD "first_name" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "protection_request" ADD "last_name" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "protection_request" ADD "phone_number" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "protection_request" ADD "city" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "protection_request" ADD "country" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "protection_request" ADD "line1" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "protection_request" ADD "line2" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "protection_request" ADD "postal_code" character varying(255)`);
    }

}
