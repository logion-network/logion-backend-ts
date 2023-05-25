import { MigrationInterface, QueryRunner } from "typeorm";

export class AddReviewAck1684933448365 implements MigrationInterface {
    name = 'AddReviewAck1684933448365'

    public async up(queryRunner: QueryRunner): Promise<void> {

        await queryRunner.query(`ALTER TABLE "loc_metadata_item" ADD "status" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "loc_metadata_item" ADD "reject_reason" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "loc_metadata_item" ADD "reviewed_on" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "loc_metadata_item" ADD "acknowledged_on" TIMESTAMP`);
        await queryRunner.query(`
            UPDATE loc_metadata_item item
            SET "status" = 'ACKNOWLEDGED'
            WHERE "draft" = 'false'
        `);

        // TODO fine-tune the following update, if required. LOC with status "REQUESTED" should likely have items "REVIEW_PENDING"
        await queryRunner.query(`
            UPDATE loc_metadata_item item
            SET "status" = 'DRAFT'
            WHERE "draft" = 'true'
        `);
        await queryRunner.query(`ALTER TABLE "loc_metadata_item" ALTER COLUMN "status" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "loc_metadata_item" DROP COLUMN "draft"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "loc_metadata_item" ADD "draft" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`
            UPDATE loc_metadata_item item
            SET "draft" = 'true'
            WHERE "status" NOT IN ('PUBLISHED', 'ACKNOWLEDGED')
        `);
        await queryRunner.query(`ALTER TABLE "loc_metadata_item" DROP COLUMN "acknowledged_on"`);
        await queryRunner.query(`ALTER TABLE "loc_metadata_item" DROP COLUMN "reviewed_on"`);
        await queryRunner.query(`ALTER TABLE "loc_metadata_item" DROP COLUMN "reject_reason"`);
        await queryRunner.query(`ALTER TABLE "loc_metadata_item" DROP COLUMN "status"`);
    }
}
