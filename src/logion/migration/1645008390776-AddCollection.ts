import {MigrationInterface, QueryRunner} from "typeorm";

export class AddCollection1645008390776 implements MigrationInterface {
    name = 'AddCollection1645008390776'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "collection_item" ("collection_loc_id" uuid NOT NULL, "item_id" character varying NOT NULL, "added_on" TIMESTAMP NOT NULL, CONSTRAINT "PK_collection_item" PRIMARY KEY ("collection_loc_id", "item_id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "collection_item"`);
    }

}
