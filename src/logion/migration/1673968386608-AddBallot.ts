import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBallot1673968386608 implements MigrationInterface {
    name = 'AddBallot1673968386608'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "ballot" ("vote_id" bigint NOT NULL, "voter" character varying NOT NULL, "result" character varying(10) NOT NULL, CONSTRAINT "PK_ballot" PRIMARY KEY ("vote_id", "voter"))`);
        await queryRunner.query(`ALTER TABLE "vote" ADD "closed" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "ballot" ADD CONSTRAINT "FK_ballot_vote_id" FOREIGN KEY ("vote_id") REFERENCES "vote"("vote_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ballot" DROP CONSTRAINT "FK_ballot_vote_id"`);
        await queryRunner.query(`ALTER TABLE "vote" DROP COLUMN "closed"`);
        await queryRunner.query(`DROP TABLE "ballot"`);
    }

}
