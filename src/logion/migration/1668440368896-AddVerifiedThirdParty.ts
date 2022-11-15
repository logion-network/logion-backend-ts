import { MigrationInterface, QueryRunner } from "typeorm";

export class AddVerifiedThirdParty1668440368896 implements MigrationInterface {
    name = 'AddVerifiedThirdParty1668440368896'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "loc_request" ADD "verified_third_party" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "loc_request" DROP COLUMN "verified_third_party"`);
    }

}
