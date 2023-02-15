import { MigrationInterface, QueryRunner } from "typeorm";

export class NewIssuerSelection1676389662380 implements MigrationInterface {
    name = 'NewIssuerSelection1676389662380'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "vtp_selection" ADD "issuer" character varying`);
        await queryRunner.query(`UPDATE "vtp_selection" SET "issuer" = "vtp_loc_id"`);
        await queryRunner.query(`ALTER TABLE "vtp_selection" ALTER COLUMN "issuer" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "vtp_selection" DROP CONSTRAINT "PK_vtp_selection"`);
        await queryRunner.query(`ALTER TABLE "vtp_selection" ADD CONSTRAINT "PK_vtp_selection" PRIMARY KEY ("loc_request_id", "issuer")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "vtp_selection" DROP CONSTRAINT "PK_vtp_selection"`);
        await queryRunner.query(`ALTER TABLE "vtp_selection" ADD CONSTRAINT "PK_vtp_selection" PRIMARY KEY ("loc_request_id", "vtp_loc_id")`);
        await queryRunner.query(`ALTER TABLE "vtp_selection" DROP COLUMN "issuer"`);
    }

}
