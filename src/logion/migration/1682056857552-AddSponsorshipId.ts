import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSponsorshipId1682056857552 implements MigrationInterface {
    name = 'AddSponsorshipId1682056857552'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "loc_request" ADD "sponsorship_id" uuid`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "loc_request" DROP COLUMN "sponsorship_id"`);
    }

}
