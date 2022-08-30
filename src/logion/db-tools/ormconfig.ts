import { DataSource, DataSourceOptions } from 'typeorm';
import { LogionNamingStrategy } from "./LogionNamingStrategy";

const config: DataSourceOptions = require("../../../ormconfig.json")

const migrationConfig: DataSourceOptions = {
    ...config,
    entities: [
        "src/logion/model/*.model.ts"
    ],
    migrations: [
        "src/logion/migration/*.ts"
    ],
    namingStrategy: new LogionNamingStrategy(),
}

const dataSource = new DataSource(migrationConfig);

export { dataSource };
