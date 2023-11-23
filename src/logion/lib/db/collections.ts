export interface HasIndex {
    index?: number;
}

export function orderAndMap<T extends HasIndex, U>(items: T[] | undefined | null, mapper: (item: T) => U): Array<U> {
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

export function isTruthy<T>(value: T | undefined | null): boolean {
    return value !== undefined && value !== null;
}
