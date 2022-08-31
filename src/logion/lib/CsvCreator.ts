import { ObjectCsvStringifier } from "csv-writer/src/lib/csv-stringifiers/object";
import { ObjectHeaderItem, Field } from "csv-writer/src/lib/record";
import { createObjectCsvStringifier } from "csv-writer";
import { ObjectMap } from "csv-writer/src/lib/lang/object";

export class CsvCreator<P extends string> {

    constructor(attributes: Record<P, string[]>) {
        let header: ObjectHeaderItem[] = [];
        for (const prefix in attributes) {
            const items = attributes[prefix].map<ObjectHeaderItem>(attribute => ({
                id: `${ prefix }.${ attribute }`,
                title: `${ prefix }.${ attribute }`
            }));
            header = header.concat(items);
        }
        this.stringifier = createObjectCsvStringifier({ header })
    }

    private stringifier: ObjectCsvStringifier;

    getHeaderString(): string | null {
        return this.stringifier.getHeaderString();
    }

    stringifyRecords(parent: Partial<Record<P, ObjectMap<Field> | undefined>>, children: Partial<Record<P, ObjectMap<Field>[] | undefined>>): string {
        let mappedParent = {};
        for (const prefix in parent) {
            mappedParent = {
                ...mappedParent,
                ...this.map(prefix, parent[prefix])
            }
        }
        let records: ObjectMap<Field>[] = [ mappedParent ];
        for (const prefix in children) {
            if (children[prefix] !== undefined) {
                const items = children[prefix]!.map(item => this.map(prefix, item));
                records = records.concat(items);
            }
        }
        return this.stringifier.stringifyRecords(records)
    }

    private map(prefix: P, item?: ObjectMap<Field>): ObjectMap<Field> | undefined {
        const result: ObjectMap<Field> = {};
        for (const attribute in item) {
            const id = `${ prefix }.${ attribute }`;
            result[id] = item[attribute];
        }
        return result;
    }
}
