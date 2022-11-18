import { MigrationInterface, QueryRunner } from "typeorm";

export class VtpSelection1668698097269 implements MigrationInterface {
    name = 'VtpSelection1668698097269'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "vtp_selection" ("loc_request_id" uuid NOT NULL, "vtp_loc_id" uuid NOT NULL, CONSTRAINT "PK_vtp_selection" PRIMARY KEY ("loc_request_id", "vtp_loc_id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "vtp_selection"`);
    }

}
