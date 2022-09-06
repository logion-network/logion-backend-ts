import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPostalAddressToLocRequest1662373797382 implements MigrationInterface {
    name = 'AddPostalAddressToLocRequest1662373797382'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "loc_request" ADD "line1" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "loc_request" ADD "line2" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "loc_request" ADD "postal_code" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "loc_request" ADD "city" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "loc_request" ADD "country" character varying(255)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "loc_request" DROP COLUMN "country"`);
        await queryRunner.query(`ALTER TABLE "loc_request" DROP COLUMN "city"`);
        await queryRunner.query(`ALTER TABLE "loc_request" DROP COLUMN "postal_code"`);
        await queryRunner.query(`ALTER TABLE "loc_request" DROP COLUMN "line2"`);
        await queryRunner.query(`ALTER TABLE "loc_request" DROP COLUMN "line1"`);
    }

}
