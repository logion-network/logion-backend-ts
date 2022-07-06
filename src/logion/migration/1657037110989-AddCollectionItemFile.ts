import {MigrationInterface, QueryRunner} from "typeorm";

export class AddCollectionItemFile1657037110989 implements MigrationInterface {
    name = 'AddCollectionItemFile1657037110989'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "collection_item" ALTER COLUMN "added_on" DROP NOT NULL`);
        await queryRunner.query(`CREATE TABLE "collection_item_file" ("collection_loc_id" uuid NOT NULL, "item_id" character varying NOT NULL, "hash" character varying NOT NULL, "cid" character varying(255) NOT NULL, CONSTRAINT "PK_collection_item_file" PRIMARY KEY ("collection_loc_id", "item_id", "hash"))`);
        await queryRunner.query(`ALTER TABLE "collection_item_file" ADD CONSTRAINT "FK_collection_item_file_collection_loc_id_item_id" FOREIGN KEY ("collection_loc_id", "item_id") REFERENCES "collection_item"("collection_loc_id","item_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "collection_item_file" DROP CONSTRAINT "FK_collection_item_file_collection_loc_id_item_id"`);
        await queryRunner.query(`DROP TABLE "collection_item_file"`);
        await queryRunner.query(`ALTER TABLE "collection_item" ALTER COLUMN "added_on" SET NOT NULL`);
    }

}
