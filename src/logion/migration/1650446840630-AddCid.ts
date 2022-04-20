import {MigrationInterface, QueryRunner} from "typeorm";

export class AddCid1650446840630 implements MigrationInterface {
    name = 'AddCid1650446840630'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "loc_request_file" ADD "cid" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "loc_request_file" ALTER COLUMN "oid" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "loc_request_file" ALTER COLUMN "oid" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "loc_request_file" DROP COLUMN "cid"`);
    }

}
