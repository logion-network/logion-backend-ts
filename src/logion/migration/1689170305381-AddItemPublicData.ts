import { MigrationInterface, QueryRunner } from "typeorm";

export class AddItemPublicData1689170305381 implements MigrationInterface {
    name = 'AddItemPublicData1689170305381'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "collection_item_tc_element" ("collection_loc_id" uuid NOT NULL, "item_id" character varying NOT NULL, "element_index" integer NOT NULL, "type" character varying(255) NOT NULL, "details" character varying(255) NOT NULL, CONSTRAINT "PK_collection_item_tc_element" PRIMARY KEY ("collection_loc_id", "item_id", "element_index"))`);
        await queryRunner.query(`ALTER TABLE "loc_request" DROP COLUMN "status_bak"`);
        await queryRunner.query(`ALTER TABLE "collection_item" ADD "description" character varying(4096)`);
        await queryRunner.query(`ALTER TABLE "collection_item" ADD "token_type" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "collection_item" ADD "token_id" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "collection_item_file" ADD "name" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "collection_item_file" ADD "content_type" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "collection_item_file" ALTER COLUMN "cid" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "collection_item_tc_element" ADD CONSTRAINT "FK_collection_item_tc_element_collection_loc_id_item_id" FOREIGN KEY ("collection_loc_id", "item_id") REFERENCES "collection_item"("collection_loc_id","item_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "collection_item_tc_element" DROP CONSTRAINT "FK_collection_item_tc_element_collection_loc_id_item_id"`);
        await queryRunner.query(`ALTER TABLE "collection_item_file" ALTER COLUMN "cid" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "collection_item_file" DROP COLUMN "content_type"`);
        await queryRunner.query(`ALTER TABLE "collection_item_file" DROP COLUMN "name"`);
        await queryRunner.query(`ALTER TABLE "collection_item" DROP COLUMN "token_id"`);
        await queryRunner.query(`ALTER TABLE "collection_item" DROP COLUMN "token_type"`);
        await queryRunner.query(`ALTER TABLE "collection_item" DROP COLUMN "description"`);
        await queryRunner.query(`ALTER TABLE "loc_request" ADD "status_bak" character varying(255)`);
        await queryRunner.query(`DROP TABLE "collection_item_tc_element"`);
    }

}
