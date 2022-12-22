import { MigrationInterface, QueryRunner } from "typeorm";

export class AddVote1671620889950 implements MigrationInterface {
    name = 'AddVote1671620889950'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "vote" ("vote_id" bigint NOT NULL, "loc_id" uuid NOT NULL, "created_on" TIMESTAMP NOT NULL, CONSTRAINT "UQ_vote_loc_id" UNIQUE ("loc_id"), CONSTRAINT "PK_vote" PRIMARY KEY ("vote_id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "vote"`);
    }

}
