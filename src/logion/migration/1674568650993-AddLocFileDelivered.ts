import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLocFileDelivered1674568650993 implements MigrationInterface {
    name = 'AddLocFileDelivered1674568650993'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "loc_request_file_delivered" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "request_id" uuid NOT NULL, "hash" character varying NOT NULL, "delivered_file_hash" character varying(255) NOT NULL, "generated_on" TIMESTAMP, "owner" character varying(255) NOT NULL, CONSTRAINT "PK_loc_request_file_delivered" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IX_loc_request_file_delivered_request_id_hash" ON "loc_request_file_delivered" ("request_id", "hash") `);
        await queryRunner.query(`ALTER TABLE "loc_request_file_delivered" ADD CONSTRAINT "FK_loc_request_file_delivered_request_id_hash" FOREIGN KEY ("request_id", "hash") REFERENCES "loc_request_file"("request_id","hash") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "loc_request_file_delivered" DROP CONSTRAINT "FK_loc_request_file_delivered_request_id_hash"`);
        await queryRunner.query(`DROP INDEX "public"."IX_loc_request_file_delivered_request_id_hash"`);
        await queryRunner.query(`DROP TABLE "loc_request_file_delivered"`);
    }

}
