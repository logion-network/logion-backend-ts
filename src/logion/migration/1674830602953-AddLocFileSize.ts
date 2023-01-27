import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLocFileSize1674830602953 implements MigrationInterface {
    name = 'AddLocFileSize1674830602953'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "loc_request_file" ADD "size" bigint NULL`);
        await queryRunner.query(`UPDATE "loc_request_file" set size = 0`);
        await queryRunner.query(`ALTER TABLE "loc_request_file" ALTER COLUMN "size" SET NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "loc_request_file" DROP COLUMN "size"`);
    }

}
