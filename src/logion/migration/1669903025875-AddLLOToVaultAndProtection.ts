import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLLOToVaultAndProtection1669903025875 implements MigrationInterface {
    name = 'AddLLOToVaultAndProtection1669903025875'

    private readonly ownerAddress: string | undefined;

    constructor() {
        this.ownerAddress = process.env.OWNER;
    }

    public async up(queryRunner: QueryRunner): Promise<void> {
        await this.addLegalOfficerAddress("protection_request", queryRunner);
        await this.addLegalOfficerAddress("vault_transfer_request", queryRunner);
    }

    private async addLegalOfficerAddress(tableName: string, queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "${ tableName }" ADD "legal_officer_address" character varying(255) NULL`);
        if (this.ownerAddress !== undefined) {
            await queryRunner.query(`UPDATE "${ tableName }"
                                     SET "legal_officer_address" = $1
                                     WHERE "legal_officer_address" IS NULL`, [ this.ownerAddress ]);
        }
        await queryRunner.query(`ALTER TABLE "${ tableName }" ALTER COLUMN "legal_officer_address" SET NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "vault_transfer_request" DROP COLUMN "legal_officer_address"`);
        await queryRunner.query(`ALTER TABLE "protection_request" DROP COLUMN "legal_officer_address"`);
    }

}
