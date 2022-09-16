import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSealHash1663232819326 implements MigrationInterface {
    name = 'AddSealHash1663232819326'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "loc_request" DROP COLUMN "salt"`);
        await queryRunner.query(`ALTER TABLE "loc_request" ADD "seal_salt" uuid`);
        await queryRunner.query(`ALTER TABLE "loc_request" ADD "seal_hash" character varying(255)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "loc_request" DROP COLUMN "seal_hash"`);
        await queryRunner.query(`ALTER TABLE "loc_request" DROP COLUMN "seal_salt"`);
        await queryRunner.query(`ALTER TABLE "loc_request" ADD "salt" uuid`);
    }

}
