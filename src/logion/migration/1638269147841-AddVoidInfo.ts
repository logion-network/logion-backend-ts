import {MigrationInterface, QueryRunner} from "typeorm";

export class AddVoidInfo1638269147841 implements MigrationInterface {
    name = 'AddVoidInfo1638269147841'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."loc_request" ADD "void_reason" text`);
        await queryRunner.query(`ALTER TABLE "public"."loc_request" ADD "voided_on" TIMESTAMP`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."loc_request" DROP COLUMN "voided_on"`);
        await queryRunner.query(`ALTER TABLE "public"."loc_request" DROP COLUMN "void_reason"`);
    }

}
