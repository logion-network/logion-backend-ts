import { MigrationInterface, QueryRunner } from "typeorm";

export class RenameLocStatus1686211213240 implements MigrationInterface {
    name = 'RenameLocStatus1686211213240'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await this.backupOldStatuses(queryRunner);
        await this.migrateRequestedLocs(queryRunner);
        await this.migrateRejectedLocs(queryRunner);
    }

    private async backupOldStatuses(queryRunner: QueryRunner) {
        await queryRunner.query(`ALTER TABLE "loc_request" ADD COLUMN "status_bak" VARCHAR(255)`);
        await queryRunner.query(`UPDATE "loc_request" SET "status_bak" = "status"`);
    }

    private async migrateRequestedLocs(queryRunner: QueryRunner) {
        await queryRunner.query(`UPDATE "loc_request" SET "status" = 'REVIEW_PENDING' WHERE "status" = 'REQUESTED'`);
    }

    private async migrateRejectedLocs(queryRunner: QueryRunner) {
        await queryRunner.query(`UPDATE "loc_request" SET "status" = 'REVIEW_REJECTED' WHERE "status" = 'REJECTED'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await this.restoreOldStatuses(queryRunner);
    }

    private async restoreOldStatuses(queryRunner: QueryRunner) {
        await queryRunner.query(`UPDATE "loc_request" SET "status" = "status_bak"`);
        await queryRunner.query(`ALTER TABLE "loc_request" DROP COLUMN "status_bak"`);
    }
}
