import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSessionUserAddressType1681287775077 implements MigrationInterface {
    name = 'AddSessionUserAddressType1681287775077'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM "session"`);
        await queryRunner.query(`ALTER TABLE "session" ADD "user_address_type" character varying(255) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "session" DROP CONSTRAINT "PK_session"`);
        await queryRunner.query(`ALTER TABLE "session" ADD CONSTRAINT "PK_session" PRIMARY KEY ("user_address", "user_address_type")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "session" DROP CONSTRAINT "PK_session"`);
        await queryRunner.query(`ALTER TABLE "session" ADD CONSTRAINT "PK_session" PRIMARY KEY ("user_address")`);
        await queryRunner.query(`ALTER TABLE "session" DROP COLUMN "user_address_type"`);
    }

}
