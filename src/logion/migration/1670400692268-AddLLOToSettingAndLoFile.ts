import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLLOToSettingAndLoFile1670400692268 implements MigrationInterface {
    name = 'AddLLOToSettingAndLoFile1670400692268'

    private readonly ownerAddress: string | undefined;

    constructor() {
        this.ownerAddress = process.env.OWNER;
    }

    public async up(queryRunner: QueryRunner): Promise<void> {
        await this.addLegalOfficerAddress("lo_file", queryRunner);
        await this.addLegalOfficerAddress("setting", queryRunner);
    }

    private async addLegalOfficerAddress(tableName: string, queryRunner: QueryRunner): Promise<void> {
        const primaryKeyName = `PK_${ tableName }`;
        await queryRunner.query(`ALTER TABLE "${ tableName }" ADD "legal_officer_address" character varying(255) NULL`);
        if (this.ownerAddress !== undefined) {
            await queryRunner.query(`UPDATE "${ tableName }"
                                     SET "legal_officer_address" = $1
                                     WHERE "legal_officer_address" IS NULL`, [ this.ownerAddress ]);
        }
        await queryRunner.query(`ALTER TABLE "${ tableName }" ALTER COLUMN "legal_officer_address" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "${ tableName }" DROP CONSTRAINT "${ primaryKeyName }"`);
        await queryRunner.query(`ALTER TABLE "${ tableName }" ADD CONSTRAINT "${ primaryKeyName }" PRIMARY KEY ("id", "legal_officer_address")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await this.removeLegalOfficerAddress("lo_file", queryRunner);
        await this.removeLegalOfficerAddress("setting", queryRunner);
    }

    private async removeLegalOfficerAddress(tableName: string, queryRunner: QueryRunner): Promise<void> {
        const primaryKeyName = `PK_${ tableName }`;
        await queryRunner.query(`ALTER TABLE "${ tableName }" DROP CONSTRAINT "${ primaryKeyName }"`);
        await queryRunner.query(`ALTER TABLE "${ tableName }" ADD CONSTRAINT "${ primaryKeyName }" PRIMARY KEY ("id")`);
        await queryRunner.query(`ALTER TABLE "${ tableName }" DROP COLUMN "legal_officer_address"`);
    }
}
