import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLegalOfficers1718188396630 implements MigrationInterface {
    name = 'AddLegalOfficers1718188396630'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "legal_officer" ("address" character varying NOT NULL, "first_name" character varying(255) NOT NULL, "last_name" character varying(255) NOT NULL, "email" character varying(255) NOT NULL, "phone_number" character varying(255) NOT NULL, "company" character varying(255), "line1" character varying(255) NOT NULL, "line2" character varying(255), "postal_code" character varying(255) NOT NULL, "city" character varying(255) NOT NULL, "country" character varying(255) NOT NULL, "additional_details" character varying(255), CONSTRAINT "PK_legal_officer" PRIMARY KEY ("address"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "legal_officer"`);
    }

}
