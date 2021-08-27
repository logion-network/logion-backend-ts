import 'reflect-metadata';
import fs from 'fs';
import { createConnection, Connection } from "typeorm";

export async function connect(entities: Function[]): Promise<void> {
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
        synchronize: true,
        entities
    });
}

let connection: Connection | null = null;

export async function disconnect(): Promise<void> {
    if(connection == null) {
        throw new Error("No connection to close");
    }
    await connection.dropDatabase();
    await connection.close();
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
