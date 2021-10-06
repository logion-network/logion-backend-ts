export interface HasIndex {
    index?: number;
}

export function list<T>(items: HasIndex[], mapper: (item: any) => T): Array<T> {
    const sortedItems = [ ...items ].sort((a, b) => a.index! - b.index!);
    return sortedItems.map(mapper);
}
