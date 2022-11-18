import { MigrationInterface, QueryRunner } from "typeorm";

export class VtpNomination1668698097269 implements MigrationInterface {
    name = 'VtpNomination1668698097269'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "vtp_nomination" ("loc_request_id" uuid NOT NULL, "vtp_loc_id" uuid NOT NULL, CONSTRAINT "PK_vtp_nomination" PRIMARY KEY ("loc_request_id", "vtp_loc_id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "vtp_nomination"`);
    }

}
