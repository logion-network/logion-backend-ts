import { ConnectionOptions } from 'typeorm';
import { LogionNamingStrategy } from "./LogionNamingStrategy";

const config: ConnectionOptions = require("../ormconfig.json")

const migrationConfig: ConnectionOptions = {
    ...config,
    entities: [
        "src/logion/model/*.model.ts"
    ],
    migrations: [
        "src/logion/migration/*.ts"
    ],
    cli: {
        migrationsDir: "src/logion/migration"
    },
    namingStrategy: new LogionNamingStrategy()
}

export = migrationConfig;
