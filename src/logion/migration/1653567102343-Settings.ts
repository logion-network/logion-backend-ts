import {MigrationInterface, QueryRunner} from "typeorm";

export class Settings1653567102343 implements MigrationInterface {
    name = 'Settings1653567102343'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "setting" ("id" character varying NOT NULL, "value" character varying NOT NULL, CONSTRAINT "PK_setting" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "setting"`);
    }
}
