import { MigrationInterface, QueryRunner } from "typeorm";

export class RenameVtp1683882984031 implements MigrationInterface {
    name = 'RenameVtp1683882984031'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "vtp_selection" RENAME TO "issuer_selection"`);
        await queryRunner.query(`ALTER TABLE "issuer_selection" RENAME COLUMN "vtp_loc_id" TO "issuer_loc_id"`);
        await queryRunner.query(`ALTER TABLE "issuer_selection" RENAME CONSTRAINT "PK_vtp_selection" TO "PK_issuer_selection"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "issuer_selection" RENAME CONSTRAINT "PK_issuer_selection" TO "PK_vtp_selection"`);
        await queryRunner.query(`ALTER TABLE "issuer_selection" RENAME COLUMN "issuer_loc_id" TO "vtp_loc_id"`);
        await queryRunner.query(`ALTER TABLE "issuer_selection" RENAME TO "vtp_selection"`);
    }

}
