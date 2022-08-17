import {MigrationInterface, QueryRunner} from "typeorm";

export class ItemFileDelivery1660729043772 implements MigrationInterface {
    name = 'ItemFileDelivery1660729043772'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "collection_item_file_delivered" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "collection_loc_id" uuid NOT NULL, "item_id" character varying NOT NULL, "hash" character varying NOT NULL, "delivered_file_hash" character varying(255) NOT NULL, "generated_on" TIMESTAMP, "owner" character varying(255) NOT NULL, CONSTRAINT "PK_collection_item_file_delivered" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "collection_item_file_delivered" ADD CONSTRAINT "FK_collection_item_file_delivered_collection_loc_id_item_id_hash" FOREIGN KEY ("collection_loc_id", "item_id", "hash") REFERENCES "collection_item_file"("collection_loc_id","item_id","hash") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "collection_item_file_delivered" DROP CONSTRAINT "FK_collection_item_file_delivered_collection_loc_id_item_id_hash"`);
        await queryRunner.query(`DROP TABLE "collection_item_file_delivered"`);
    }

}
