import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSecretStatus1716302125635 implements MigrationInterface {
    name = 'AddSecretStatus1716302125635'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "secret_recovery_request" ADD "status" character varying(255) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "secret_recovery_request" ADD "decision_on" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "secret_recovery_request" ADD "reject_reason" character varying(255)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "secret_recovery_request" DROP COLUMN "reject_reason"`);
        await queryRunner.query(`ALTER TABLE "secret_recovery_request" DROP COLUMN "decision_on"`);
        await queryRunner.query(`ALTER TABLE "secret_recovery_request" DROP COLUMN "status"`);
    }

}
