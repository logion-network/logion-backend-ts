import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRecordPublicData1689239362222 implements MigrationInterface {
    name = 'AddRecordPublicData1689239362222'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tokens_record" ADD "description" character varying(4096)`);
        await queryRunner.query(`ALTER TABLE "tokens_record_file" ADD "name" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "tokens_record_file" ADD "content_type" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "tokens_record_file" ALTER COLUMN "cid" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tokens_record_file" ALTER COLUMN "cid" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "tokens_record_file" DROP COLUMN "content_type"`);
        await queryRunner.query(`ALTER TABLE "tokens_record_file" DROP COLUMN "name"`);
        await queryRunner.query(`ALTER TABLE "tokens_record" DROP COLUMN "description"`);
    }

}
