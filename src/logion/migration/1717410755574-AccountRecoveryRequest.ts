import { MigrationInterface, QueryRunner } from "typeorm";

export class AccountRecoveryRequest1717410755574 implements MigrationInterface {
    name = 'AccountRecoveryRequest1717410755574'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "protection_request" DROP COLUMN "is_recovery"`);
        await queryRunner.query(`ALTER TABLE "protection_request" RENAME TO "account_recovery_request"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "account_recovery_request" RENAME TO "protection_request"`);
        await queryRunner.query(`ALTER TABLE "protection_request" ADD COLUMN "is_recovery" boolean`);
        await queryRunner.query(`UPDATE "protection_request" SET "is_recovery" = TRUE`);
        await queryRunner.query(`ALTER TABLE "protection_request" ALTER COLUMN "is_recovery" SET NOT NULL`);
    }

}
