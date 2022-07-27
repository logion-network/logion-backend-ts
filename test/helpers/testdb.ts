import 'reflect-metadata';
import fs from 'fs';
import { QueryRunner, MigrationInterface, DataSource } from "typeorm";
import { createConnection } from '../../src/logion/orm';

export async function connect(
    entities: (Function | string)[],
    migrations?: (Function | string)[],
    synchronize: boolean = true): Promise<void>
{
    if(connection != null) {
        throw new Error("Connection already created");
    }
    connection = await createConnection({
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
}

let connection: DataSource | null = null;

export async function disconnect(): Promise<void> {
    if(connection == null) {
        throw new Error("No connection to close");
    }
    await connection.dropDatabase();
    await connection.destroy();
    connection = null;
}

export type RawData = any[] | undefined;

export async function query(sql: string): Promise<RawData> {
    return connection!.query(sql);
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
    return connection?.createQueryRunner()!
}

export function allMigrations(): MigrationInterface[] {
    return connection?.migrations!;
}


