import {MigrationInterface, QueryRunner} from "typeorm";

export class AddLocFileUniqueConstraint1637229545243 implements MigrationInterface {
    name = 'AddLocFileUniqueConstraint1637229545243'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."loc_request_file" DROP CONSTRAINT "PK_loc_request_file"`);
        await queryRunner.query(`ALTER TABLE "public"."loc_request_file" ADD CONSTRAINT "PK_loc_request_file" PRIMARY KEY ("request_id", "hash")`);
        await queryRunner.query(`ALTER TABLE "public"."loc_request_file" ADD CONSTRAINT "UQ_loc_request_file_request_id_index" UNIQUE ("request_id", "index")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."loc_request_file" DROP CONSTRAINT "UQ_loc_request_file_request_id_index"`);
        await queryRunner.query(`ALTER TABLE "public"."loc_request_file" DROP CONSTRAINT "PK_loc_request_file"`);
        await queryRunner.query(`ALTER TABLE "public"."loc_request_file" ADD CONSTRAINT "PK_loc_request_file" PRIMARY KEY ("request_id", "hash", "index")`);
    }

}
