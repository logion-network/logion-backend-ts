export interface HasIndex {
    index?: number;
}

export function order<T>(items: HasIndex[], mapper: (item: any) => T): Array<T> {
    const sortedItems = [ ...items ].sort((a, b) => a.index! - b.index!);
    return sortedItems.map(mapper);
}
