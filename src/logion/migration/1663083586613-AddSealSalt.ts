import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSealSalt1663083586613 implements MigrationInterface {
    name = 'AddSealSalt1663083586613'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "loc_request" ADD "salt" uuid`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "loc_request" DROP COLUMN "salt"`);
    }

}
