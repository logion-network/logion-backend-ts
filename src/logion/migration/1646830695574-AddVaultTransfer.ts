import {MigrationInterface, QueryRunner} from "typeorm";

export class AddVaultTransfer1646830695574 implements MigrationInterface {
    name = 'AddVaultTransfer1646830695574'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "vault_transfer_request" ("id" uuid NOT NULL, "created_on" TIMESTAMP, "requester_address" character varying(255) NOT NULL, "destination" character varying(255) NOT NULL, "amount" numeric(50) NOT NULL, "call" character varying(255) NOT NULL, "block_number" bigint NOT NULL, "extrinsic_index" integer NOT NULL, "status" character varying(255) NOT NULL, "decision_on" TIMESTAMP, "reject_reason" character varying(255), CONSTRAINT "UQ_vault_transfer_request_block_number_extrinsic_index" UNIQUE ("block_number", "extrinsic_index"), CONSTRAINT "PK_vault_transfer_request" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "vault_transfer_request"`);
    }

}
