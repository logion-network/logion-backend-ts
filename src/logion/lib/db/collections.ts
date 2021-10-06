export interface HasIndex {
    index?: number;
}

export function order<T>(items: HasIndex[] | undefined | null, mapper: (item: any) => T): Array<T> {
    if(items === undefined || items === null) {
        return [];
    }
    const sortedItems = [ ...items ].sort((a, b) => a.index! - b.index!);
    return sortedItems.map(mapper);
}
