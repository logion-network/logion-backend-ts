import { TestDb } from "@logion/rest-api-core";
const { connect, disconnect, queryRunner, runAllMigrations, revertAllMigrations } = TestDb;

describe('Migration', () => {

    const NUM_OF_TABLES = 22;
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

    beforeEach(async () => {
        await connect([ "src/logion/model/*.model.ts" ], [ "src/logion/migration/*.ts" ], false);
    });

    afterEach(async () => {
        await disconnect();
    });

    it("executes all up()", async () => {

        // Given
        const runner = queryRunner();
        const tablesBefore = await runner.getTables();

        // When
        await runAllMigrations()

        // Then
        const tablesAfter = await runner.getTables();
        expect(tablesAfter.length - tablesBefore.length - 1).toBe(NUM_OF_TABLES);
    })

    it("executes all down()", async () => {

        // Given
        await runAllMigrations();
        const runner = queryRunner();
        const tablesBefore = await runner.getTables();

        // When
        await revertAllMigrations();

        // Then
        const tablesAfter = await runner.getTables();
        expect(tablesBefore.length - tablesAfter.length).toBe(NUM_OF_TABLES);
    })
})
