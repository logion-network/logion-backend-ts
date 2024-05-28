import { MigrationInterface, QueryRunner } from "typeorm";

export class SecretDownload1716820387622 implements MigrationInterface {
    name = 'SecretDownload1716820387622'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "secret_recovery_request" ADD "downloaded" boolean`);
        await queryRunner.query(`UPDATE "secret_recovery_request" SET "downloaded" = FALSE`);
        await queryRunner.query(`ALTER TABLE "secret_recovery_request" ALTER COLUMN "downloaded" SET NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "secret_recovery_request" DROP COLUMN "downloaded"`);
    }

}
