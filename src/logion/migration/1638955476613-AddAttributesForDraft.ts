import {MigrationInterface, QueryRunner} from "typeorm";

export class AddAttributesForDraft1638955476613 implements MigrationInterface {
    name = 'AddAttributesForDraft1638955476613'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."loc_request_file" ADD "nature" character varying(255)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."loc_request_file" DROP COLUMN "nature"`);
    }

}
