import { MigrationInterface, QueryRunner } from "typeorm";

export class TokensRecord1676475638637 implements MigrationInterface {
    name = 'TokensRecord1676475638637'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "tokens_record" ("collection_loc_id" uuid NOT NULL, "record_id" character varying NOT NULL, "added_on" TIMESTAMP, CONSTRAINT "PK_tokens_record" PRIMARY KEY ("collection_loc_id", "record_id"))`);
        await queryRunner.query(`CREATE TABLE "tokens_record_file" ("collection_loc_id" uuid NOT NULL, "record_id" character varying NOT NULL, "hash" character varying NOT NULL, "cid" character varying(255) NOT NULL, CONSTRAINT "PK_tokens_record_file" PRIMARY KEY ("collection_loc_id", "record_id", "hash"))`);
        await queryRunner.query(`CREATE TABLE "tokens_record_file_delivered" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "collection_loc_id" uuid NOT NULL, "record_id" character varying NOT NULL, "hash" character varying NOT NULL, "delivered_file_hash" character varying(255) NOT NULL, "generated_on" TIMESTAMP, "owner" character varying(255) NOT NULL, CONSTRAINT "PK_tokens_record_file_delivered" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IX_tokens_record_file_delivered_collection_loc_id_record_id_has" ON "tokens_record_file_delivered" ("collection_loc_id", "record_id", "hash") `);
        await queryRunner.query(`ALTER TABLE "tokens_record_file" ADD CONSTRAINT "FK_tokens_record_file_collection_loc_id_record_id" FOREIGN KEY ("collection_loc_id", "record_id") REFERENCES "tokens_record"("collection_loc_id","record_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tokens_record_file_delivered" ADD CONSTRAINT "FK_tokens_record_file_delivered_collection_loc_id_record_id_has" FOREIGN KEY ("collection_loc_id", "record_id", "hash") REFERENCES "tokens_record_file"("collection_loc_id","record_id","hash") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tokens_record_file_delivered" DROP CONSTRAINT "FK_tokens_record_file_delivered_collection_loc_id_record_id_has"`);
        await queryRunner.query(`ALTER TABLE "tokens_record_file" DROP CONSTRAINT "FK_tokens_record_file_collection_loc_id_record_id"`);
        await queryRunner.query(`DROP INDEX "public"."IX_tokens_record_file_delivered_collection_loc_id_record_id_has"`);
        await queryRunner.query(`DROP TABLE "tokens_record_file_delivered"`);
        await queryRunner.query(`DROP TABLE "tokens_record_file"`);
        await queryRunner.query(`DROP TABLE "tokens_record"`);
    }

}
