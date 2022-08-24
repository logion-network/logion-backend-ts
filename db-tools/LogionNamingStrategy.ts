import { DefaultNamingStrategy, Table } from "typeorm";

export class LogionNamingStrategy extends DefaultNamingStrategy {

    primaryKeyName(tableOrName: Table | string, _columnNames: string[]): string {
        const tableName = this.actualTableName(tableOrName);
        return `PK_${ tableName }`
    }

    private actualTableName(tableOrName: Table | string): string {
        return typeof tableOrName === "string" ? tableOrName : tableOrName.name;
    }

    uniqueConstraintName(tableOrName: Table | string, columnNames: string[]): string {
        const tableName = this.actualTableName(tableOrName);
        return columnNames.reduce((name, column) => `${ name }_${ column }`, `UQ_${ tableName }`);
    }

    foreignKeyName(tableOrName: Table | string, columnNames: string[], _referencedTablePath?: string, _referencedColumnNames?: string[]): string {
        const tableName = this.actualTableName(tableOrName);
        return columnNames.reduce((name, column) => `${ name }_${ column }`, `FK_${ tableName }`);
    }

    indexName(tableOrName: Table | string, columnNames: string[], _where?: string): string {
        const tableName = this.actualTableName(tableOrName);
        return columnNames.reduce((name, column) => `${ name }_${ column }`, `IX_${ tableName }`);
    }
}
