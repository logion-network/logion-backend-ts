import { MigrationInterface, QueryRunner } from "typeorm";

export class AddReviewAck1684933448365 implements MigrationInterface {
    name = 'AddReviewAck1684933448365'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await this.upTable(queryRunner, "loc_metadata_item");
        await this.upTable(queryRunner, "loc_request_file");
    }
    
    async upTable(queryRunner: QueryRunner, table: string): Promise<void> {

        await queryRunner.query(`ALTER TABLE "${ table }" ADD "status" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "${ table }" ADD "reject_reason" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "${ table }" ADD "reviewed_on" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "${ table }" ADD "acknowledged_on" TIMESTAMP`);
        
        // draft=false > ACKNOWLEDGED 
        await queryRunner.query(`
            UPDATE ${ table } item
            SET "status" = 'ACKNOWLEDGED'
            WHERE "draft" = 'false'
        `);

        // LOC DRAFT => ITEM draft=true > DRAFT
        await queryRunner.query(`
            UPDATE ${ table } item
            SET "status" = 'DRAFT'
            FROM loc_request loc
            WHERE 1=1
              AND item.draft = 'true'
              AND loc.id = item.request_id
              AND loc.status = 'DRAFT'
        `);
        // LOC (REQUESTED, OPEN), SUBMITTER = OWNER => ITEM draft=true > REVIEW_ACCEPTED
        await queryRunner.query(`
            UPDATE ${ table } item
            SET "status" = 'REVIEW_ACCEPTED'
            FROM loc_request loc
            WHERE 1=1
              AND item.draft = 'true'
              AND loc.id = item.request_id
              AND loc.status in ('REQUESTED', 'OPEN')
              AND loc.owner_address = item.submitter_address
        `);
        // EVERYTHING ELSE => ITEM draft=true > REVIEW_PENDING
        await queryRunner.query(`
            UPDATE ${ table } item
            SET "status" = 'REVIEW_PENDING'
            FROM loc_request loc
            WHERE 1=1
              AND item.draft = 'true'
              AND item.status IS NULL
        `);

        await queryRunner.query(`ALTER TABLE "${ table }" ALTER COLUMN "status" SET NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await this.downTable(queryRunner, "loc_metadata_item");
        await this.downTable(queryRunner, "loc_request_file");
    }
    
    async downTable(queryRunner: QueryRunner, table: string): Promise<void> {
        await queryRunner.query(`ALTER TABLE "${ table }" DROP COLUMN "acknowledged_on"`);
        await queryRunner.query(`ALTER TABLE "${ table }" DROP COLUMN "reviewed_on"`);
        await queryRunner.query(`ALTER TABLE "${ table }" DROP COLUMN "reject_reason"`);
        await queryRunner.query(`ALTER TABLE "${ table }" DROP COLUMN "status"`);
    }
}
