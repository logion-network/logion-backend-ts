import { ChildProcess, exec } from 'child_process';
import { getConnectionOptions } from 'typeorm';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

export async function importFile(path: string, comment: string): Promise<number> {
    const process = await callPsql();
    return buildLargeObjectIdPromise(path, comment, process);
}

async function callPsql(): Promise<ChildProcess> {
    const psqlEnvironment = await getPsqlEnvironment();
    const options = {
        env: psqlEnvironment
    };
    return exec('psql', options);
}

async function getPsqlEnvironment(): Promise<NodeJS.ProcessEnv> {
    const postgreConnectionOptions = await getPostgresConnectionOptions();
    const { host, port, username, password, database } = postgreConnectionOptions;
    return {
        PGHOST: host as string,
        PGPORT: port!.toString() || "5432",
        PGUSER: username as string,
        PGPASSWORD: password as string,
        PGDATABASE: database as string,
    };
}

async function getPostgresConnectionOptions(): Promise<PostgresConnectionOptions> {
    const connectionOptions = await getConnectionOptions();
    if(connectionOptions.type !== 'postgres') {
        throw new Error("Only PostgreSQL is supported");
    }
    return connectionOptions as PostgresConnectionOptions;
}

async function buildLargeObjectIdPromise(path: string, comment: string, process: ChildProcess): Promise<number> {
    const promise = new Promise<number>((success, error) => {
        let output: string;
        process.stdout!.on('data', (data) => {
            output = data.toString();
        });
        process.on('exit', () => {
            const largeObjectId = output.substring("lo_import ".length);
            success(Number(largeObjectId));
        });
        process.on('error', error);

        process.stdin!.write(Buffer.from(`\\lo_import '${path}' '${comment}'`, "utf-8"));
        process.stdin!.end();
    });
    return promise;
}
