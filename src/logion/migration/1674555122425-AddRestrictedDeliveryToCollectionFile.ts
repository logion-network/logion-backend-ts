import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRestrictedDeliveryToCollectionFile1674555122425 implements MigrationInterface {
    name = 'AddRestrictedDeliveryToCollectionFile1674555122425'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "loc_request_file" ADD "restricted_delivery" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "loc_request_file" DROP COLUMN "restricted_delivery"`);
    }

}
