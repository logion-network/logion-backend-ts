import { LogionNamingStrategy } from "./db-tools/LogionNamingStrategy";
import { DataSource, DataSourceOptions } from "typeorm";
import dotenv from "dotenv";
import { existsSync, readFileSync } from "fs";

dotenv.config();

const CONFIG_FILE = "ormconfig.json";

export let appDataSource = buildDefaultDataSource();

function buildDefaultDataSource(): DataSource {
    const options = buildDefaultDataSourceOptions();
    return new DataSource(options);
}

function buildDefaultDataSourceOptions(): DataSourceOptions {
    const fileConfig = getFileConfig();
    const envConfig = getEnvConfig();
    return {
        ...fileConfig,
        ...envConfig,
        namingStrategy: new LogionNamingStrategy(),
    };
}

function getFileConfig(): any {
    if(existsSync(CONFIG_FILE)) {
        const content = readFileSync(CONFIG_FILE);
        return JSON.parse(content.toString("utf-8"));
    } else {
        return {};
    }
}

function getEnvConfig(): any {
    const options: any = {};
    setFromEnvIfDefined(options, "TYPEORM_CONNECTION", "type");
    setFromEnvIfDefined(options, "TYPEORM_HOST", "host");
    setFromEnvIfDefined(options, "TYPEORM_PORT", "port");
    setFromEnvIfDefined(options, "TYPEORM_USERNAME", "username");
    setFromEnvIfDefined(options, "TYPEORM_PASSWORD", "password");
    setFromEnvIfDefined(options, "TYPEORM_DATABASE", "database");
    setFromEnvIfDefined(options, "TYPEORM_SYNCHRONIZE", "synchronize");
    setFromEnvIfDefined(options, "TYPEORM_ENTITIES", "entities", value => [ value ]);
    setFromEnvIfDefined(options, "TYPEORM_MIGRATIONS", "migrations", value => [ value ]);
    return options;
}

function setFromEnvIfDefined(options: any, envName: string, optionName: string, transform?: (value: string) => any) {
    const envValue = process.env[envName];
    if(envValue) {
        options[optionName] = transform !== undefined ? transform(envValue) : envValue;
    }
}

export function overrideDataSource(dataSource: DataSource) {
    appDataSource = dataSource;
}
