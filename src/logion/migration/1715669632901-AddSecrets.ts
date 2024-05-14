import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSecrets1715669632901 implements MigrationInterface {
    name = 'AddSecrets1715669632901'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "loc_secret" ("request_id" uuid NOT NULL, "name" character varying(255) NOT NULL, "value" character varying(4096) NOT NULL, CONSTRAINT "UQ_loc_secret_request_id_name" UNIQUE ("request_id", "name"), CONSTRAINT "PK_loc_secret" PRIMARY KEY ("request_id", "name"))`);
        await queryRunner.query(`ALTER TABLE "loc_secret" ADD CONSTRAINT "FK_loc_secret_request_id" FOREIGN KEY ("request_id") REFERENCES "loc_request"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "loc_secret" DROP CONSTRAINT "FK_loc_secret_request_id"`);
        await queryRunner.query(`DROP TABLE "loc_secret"`);
    }

}
