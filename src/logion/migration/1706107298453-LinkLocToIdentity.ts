import { MigrationInterface, QueryRunner } from "typeorm"

export class LinkLocToIdentity1706107298453 implements MigrationInterface {

    name = 'LinkLocToIdentity1706107298453';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE loc_request loc
            SET requester_identity_loc =
                    (SELECT identity_loc.id
                     FROM loc_request identity_loc
                     WHERE identity_loc.loc_type = 'Identity'
                       AND identity_loc.requester_address = loc.requester_address
                       AND identity_loc.requester_address_type = loc.requester_address_type
                       AND identity_loc.owner_address = loc.owner_address
                       AND identity_loc.status = 'CLOSED'
                       AND identity_loc.void_reason IS NULL
                       AND identity_loc.voided_on IS NULL)
            WHERE loc_type in ('Transaction', 'Collection')
              AND requester_identity_loc IS NULL
              AND requester_address IS NOT NULL
              AND requester_address_type IS NOT NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE loc_request loc
            SET requester_identity_loc = NULL
            WHERE loc_type in ('Transaction', 'Collection')
              AND requester_address IS NOT NULL
              AND requester_address_type IS NOT NULL
        `);
    }
}
