import { DefaultNamingStrategy, Table } from "typeorm";

export class LogionNamingStrategy extends DefaultNamingStrategy {

    primaryKeyName(tableOrName: Table | string, columnNames: string[]): string {
        const tableName = typeof tableOrName === "string" ? tableOrName : tableOrName.name;
        return `PK_${ tableName }`
    }

    uniqueConstraintName(tableOrName: Table | string, columnNames: string[]): string {
        const tableName = typeof tableOrName === "string" ? tableOrName : tableOrName.name;
        return columnNames.reduce((name, column) => `${ name }_${ column }`, `UQ_${ tableName }`);
    }

    foreignKeyName(tableOrName: Table | string, columnNames: string[], _referencedTablePath?: string, _referencedColumnNames?: string[]): string {
        const tableName = typeof tableOrName === "string" ? tableOrName : tableOrName.name;
        return columnNames.reduce((name, column) => `${ name }_${ column }`, `FK_${ tableName }`);
    }
}
