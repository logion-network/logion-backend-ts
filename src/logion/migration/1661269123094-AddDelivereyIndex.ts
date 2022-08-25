import {MigrationInterface, QueryRunner} from "typeorm";

export class AddDelivereyIndex1661269123094 implements MigrationInterface {
    name = 'AddDelivereyIndex1661269123094'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX "IX_collection_item_file_delivered_collection_loc_id_item_id_hash" ON "collection_item_file_delivered" ("collection_loc_id", "item_id", "hash") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IX_collection_item_file_delivered_collection_loc_id_item_id_hash"`);
    }

}
