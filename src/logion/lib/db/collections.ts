export interface HasIndex {
    index?: number;
}

export function orderAndMap<T>(items: HasIndex[] | undefined | null, mapper: (item: any) => T): Array<T> {
    if(items === undefined || items === null) {
        return [];
    }
    const sortedItems = [ ...items ].sort((a, b) => a.index! - b.index!);
    return sortedItems.map(mapper);
}

export function order<T extends HasIndex>(items: T[] | undefined | null): Array<T> {
    if(items === undefined || items === null) {
        return [];
    }
    return [ ...items ].sort((a, b) => a.index! - b.index!);
}
