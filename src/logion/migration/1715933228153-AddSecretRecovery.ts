import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSecretRecovery1715933228153 implements MigrationInterface {
    name = 'AddSecretRecovery1715933228153'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "secret_recovery_request" ("id" uuid NOT NULL, "requester_identity_loc_id" uuid NOT NULL, "legal_officer_address" character varying(255) NOT NULL, "secret_name" character varying(255) NOT NULL, "challenge" character varying(255) NOT NULL, "created_on" TIMESTAMP NOT NULL, "first_name" character varying(255), "last_name" character varying(255), "email" character varying(255), "phone_number" character varying(255), "line1" character varying(255), "line2" character varying(255), "postal_code" character varying(255), "city" character varying(255), "country" character varying(255), CONSTRAINT "PK_secret_recovery_request" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "secret_recovery_request"`);
    }

}
