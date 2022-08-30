import 'reflect-metadata';
import fs from 'fs';
import { QueryRunner, MigrationInterface, DataSource } from "typeorm";
import { overrideDataSource } from '../../src/logion/app-datasource';

export async function connect(
    entities: (Function | string)[],
    migrations?: (Function | string)[],
    synchronize: boolean = true): Promise<void>
{
    if(dataSource != null) {
        throw new Error("Connection already created");
    }
    dataSource = new DataSource({
        type: "postgres",
        host: "localhost",
        port: 5432,
        username: "postgres",
        password: "secret",
        database: "postgres",
        synchronize,
        entities,
        migrations
    });
    await dataSource.initialize();
    overrideDataSource(dataSource);
}

let dataSource: DataSource | null = null;

export async function disconnect(): Promise<void> {
    if(dataSource == null) {
        throw new Error("No connection to close");
    }
    await dataSource.dropDatabase();
    await dataSource.destroy();
    dataSource = null;
}

export type RawData = any[] | undefined;

export async function query(sql: string): Promise<RawData> {
    return dataSource!.query(sql);
}

export async function executeScript(fileName: string): Promise<void> {
    const fileContent = await fs.promises.readFile(fileName);
    await query(fileContent.toString("utf-8"));
}

export async function checkNumOfRows(sql: string, numOfRows: number) {
    const rawData: RawData = await query(sql)
    expect(rawData).toBeDefined()
    expect(rawData!.length).toBe(numOfRows)
}

export function queryRunner(): QueryRunner {
    return dataSource?.createQueryRunner()!
}

export function allMigrations(): MigrationInterface[] {
    return dataSource?.migrations!;
}
