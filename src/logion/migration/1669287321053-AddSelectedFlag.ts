import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSelectedFlag1669287321053 implements MigrationInterface {
    name = 'AddSelectedFlag1669287321053'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "vtp_selection" ADD "selected" boolean NOT NULL DEFAULT true`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "vtp_selection" DROP COLUMN "selected"`);
    }

}
