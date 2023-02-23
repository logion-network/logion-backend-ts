import { MigrationInterface, QueryRunner } from "typeorm";

export class LocTemplate1677148843394 implements MigrationInterface {
    name = 'LocTemplate1677148843394'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "loc_request" ADD "template" character varying(255)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "loc_request" DROP COLUMN "template"`);
    }

}
