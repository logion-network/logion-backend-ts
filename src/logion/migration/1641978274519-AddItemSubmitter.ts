import {MigrationInterface, QueryRunner} from "typeorm";

export class AddItemSubmitter1641978274519 implements MigrationInterface {
    name = 'AddItemSubmitter1641978274519'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."loc_request_file" ADD "submitter" character varying(255)`);
        await queryRunner.query(`
            UPDATE loc_request_file item
            SET submitter = (SELECT owner_address FROM loc_request request where item.request_id = request.id)
        `);
        await queryRunner.query(`ALTER TABLE "public"."loc_request_file" ALTER COLUMN "submitter" SET NOT NULL`);

        await queryRunner.query(`ALTER TABLE "public"."loc_metadata_item" ADD "submitter" character varying(255)`);
        await queryRunner.query(`
            UPDATE loc_metadata_item item
            SET submitter = (SELECT owner_address FROM loc_request request where item.request_id = request.id )
        `);
        await queryRunner.query(`ALTER TABLE "public"."loc_metadata_item" ALTER COLUMN "submitter" SET NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."loc_metadata_item" DROP COLUMN "submitter"`);
        await queryRunner.query(`ALTER TABLE "public"."loc_request_file" DROP COLUMN "submitter"`);
    }

}
