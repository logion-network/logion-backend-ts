import { connect, disconnect, queryRunner, allMigrations } from "../../helpers/testdb";
import { MigrationInterface, QueryRunner } from "typeorm";
import { Log } from "../../../src/logion/util/Log";

const { logger } = Log;

describe('Migration', () => {

    const NUM_OF_TABLES = 11;

    beforeEach(async () => {
        await connect([ "src/logion/model/*.model.ts" ], [ "src/logion/migration/*.ts" ], false);
    });

    afterEach(async () => {
        await disconnect();
    });

    async function testMigrationUp(migration: MigrationInterface, runner:QueryRunner) {
        logger.info("Migrating UP %s ", migration.name)
        await migration.up(runner)
    }

    async function runAllMigrations(runner:QueryRunner) {
        for (const migration of allMigrations()) {
            await testMigrationUp(migration, runner);
        }
    }

    it("executes all up()", async () => {

        // Given
        const runner = queryRunner()
        const tablesBefore = await runner.getTables()

        // When
        await runAllMigrations(runner)

        // Then
        const tablesAfter = await runner.getTables();
        expect(tablesAfter.length - tablesBefore.length).toBe(NUM_OF_TABLES)
    })

    async function testMigrationDown(migration: MigrationInterface, runner:QueryRunner) {
        logger.info("Migrating DOWN %s ", migration.name)
        await migration.down(runner)
    }

    it("executes all down()", async () => {

        // Given
        const runner = queryRunner()
        await runAllMigrations(runner)
        const tablesBefore = await runner.getTables()

        // When
        for (const migration of allMigrations().reverse()) {
            await testMigrationDown(migration, runner);
        }

        // Then
        const tablesAfter = await runner.getTables();
        expect(tablesBefore.length - tablesAfter.length).toBe(NUM_OF_TABLES)
    })
})
