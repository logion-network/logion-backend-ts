import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLinkSubmitterAndLifecycle1695136615896 implements MigrationInterface {
    name = 'AddLinkSubmitterAndLifecycle1695136615896'

    public async up(queryRunner: QueryRunner): Promise<void> {

        await this.addSubmitter(queryRunner);
        await this.addLifecycle(queryRunner);
    }
    
    async addSubmitter(queryRunner: QueryRunner): Promise<void> {
        // submitter
        await queryRunner.query(`ALTER TABLE "loc_link" ADD "submitter_address" character varying(255)`);
        await queryRunner.query(`
            UPDATE "loc_link" item
            SET "submitter_address" = (SELECT owner_address FROM loc_request request where item.request_id = request.id )
        `);
        await queryRunner.query(`ALTER TABLE "loc_link" ALTER COLUMN "submitter_address" SET NOT NULL`);

        // submitter_address_type
        await queryRunner.query(`ALTER TABLE "loc_link" ADD "submitter_address_type" character varying(255)`);
        await queryRunner.query(`UPDATE "loc_link" SET "submitter_address_type" = 'Polkadot'`);
        await queryRunner.query(`ALTER TABLE "loc_link" ALTER COLUMN "submitter_address_type" SET NOT NULL`);
    }

    async addLifecycle(queryRunner: QueryRunner): Promise<void> {

        await queryRunner.query(`ALTER TABLE "loc_link" ADD "status" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "loc_link" ADD "reject_reason" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "loc_link" ADD "reviewed_on" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "loc_link" ADD "acknowledged_by_owner_on" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "loc_link" ADD "acknowledged_by_owner" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "loc_link" ADD "acknowledged_by_verified_issuer_on" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "loc_link" ADD "acknowledged_by_verified_issuer" boolean NOT NULL DEFAULT false`);

        // draft=false > ACKNOWLEDGED
        await queryRunner.query(`
            UPDATE "loc_link" item
            SET "status" = 'ACKNOWLEDGED', "acknowledged_by_owner" = true
            WHERE "draft" = 'false'
        `);

        // EVERYTHING ELSE => > REVIEW_ACCEPTED
        await queryRunner.query(`
            UPDATE "loc_link" item
            SET "status" = 'REVIEW_ACCEPTED'
            WHERE "status" IS NULL
        `);

        await queryRunner.query(`ALTER TABLE "loc_link" ALTER COLUMN "status" SET NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "loc_link" DROP COLUMN "acknowledged_by_verified_issuer"`);
        await queryRunner.query(`ALTER TABLE "loc_link" DROP COLUMN "acknowledged_by_verified_issuer_on"`);
        await queryRunner.query(`ALTER TABLE "loc_link" DROP COLUMN "acknowledged_by_owner"`);
        await queryRunner.query(`ALTER TABLE "loc_link" DROP COLUMN "acknowledged_by_owner_on"`);
        await queryRunner.query(`ALTER TABLE "loc_link" DROP COLUMN "reviewed_on"`);
        await queryRunner.query(`ALTER TABLE "loc_link" DROP COLUMN "reject_reason"`);
        await queryRunner.query(`ALTER TABLE "loc_link" DROP COLUMN "status"`);
        await queryRunner.query(`ALTER TABLE "loc_link" DROP COLUMN "submitter_address"`);
        await queryRunner.query(`ALTER TABLE "loc_link" DROP COLUMN "submitter_address_type"`);
    }

}
