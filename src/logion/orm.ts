import fs from "fs";
import { DataSource, DataSourceOptions, Entity, EntityManager } from "typeorm";

let dataSource: DataSource;

let entityManager: EntityManager;

export async function createConnection(options?: DataSourceOptions): Promise<DataSource> {
    if(options) {
        dataSource = new DataSource(options);
    } else {
        dataSource = new DataSource(loadDataSourceConfig());
    }
    await dataSource.initialize();

    entityManager = new EntityManager(dataSource);

    return dataSource;
}

function loadDataSourceConfig(): DataSourceOptions {
    const content = fs.readFileSync("ormconfig.json");
    return JSON.parse(content.toString('utf8'));
}

export function getDataSource(): DataSource {
    return dataSource;
}

export function getManager(): EntityManager {
    return entityManager;
}
