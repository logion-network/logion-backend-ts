import { DataSource, DataSourceOptions } from 'typeorm';
import { LogionNamingStrategy } from "@logion/rest-api-core";
import { readFileSync } from 'fs';

const config: DataSourceOptions = JSON.parse(readFileSync("ormconfig.json").toString());

const migrationConfig: DataSourceOptions = {
    ...config,
    entities: [
        "dist/model/*.model.js"
    ],
    migrations: [
        "dist/migration/*.js"
    ],
    namingStrategy: new LogionNamingStrategy(),
}

const dataSource = new DataSource(migrationConfig);

export { dataSource };
