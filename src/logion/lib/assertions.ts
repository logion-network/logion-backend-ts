export function requireDefined<T>(value: T | undefined): T {
    if(value === undefined) {
        throw new Error("Value is undefined");
    } else {
        return value;
    }
}
