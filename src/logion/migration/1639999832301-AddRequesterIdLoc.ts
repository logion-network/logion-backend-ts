import {MigrationInterface, QueryRunner} from "typeorm";

export class AddRequesterIdentityLoc1639999832301 implements MigrationInterface {
    name = 'AddRequesterIdentityLoc1639999832301'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."loc_request" ADD "requester_identity_loc" uuid`);
        await queryRunner.query(`ALTER TABLE "public"."loc_request" ALTER COLUMN "requester_address" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."loc_request" ADD CONSTRAINT "FK_loc_request_requester_identity_loc" FOREIGN KEY ("requester_identity_loc") REFERENCES "loc_request"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."loc_request" DROP CONSTRAINT "FK_loc_request_requester_identity_loc"`);
        await queryRunner.query(`ALTER TABLE "public"."loc_request" ALTER COLUMN "requester_address" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."loc_request" DROP COLUMN "requester_identity_loc"`);
    }

}
