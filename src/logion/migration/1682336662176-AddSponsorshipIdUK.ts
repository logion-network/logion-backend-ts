import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSponsorshipIdUK1682336662176 implements MigrationInterface {
    name = 'AddSponsorshipIdUK1682336662176'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "loc_request" ADD CONSTRAINT "UQ_loc_request_sponsorship_id" UNIQUE ("sponsorship_id")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "loc_request" DROP CONSTRAINT "UQ_loc_request_sponsorship_id"`);
    }

}
