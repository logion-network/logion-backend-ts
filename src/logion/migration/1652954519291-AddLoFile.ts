import {MigrationInterface, QueryRunner} from "typeorm";

export class AddLoFile1652954519291 implements MigrationInterface {
    name = 'AddLoFile1652954519291'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "lo_file" ("id" character varying(255) NOT NULL, "content_type" character varying(255) NOT NULL, "oid" integer NOT NULL, CONSTRAINT "PK_lo_file" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "lo_file"`);
    }
}
