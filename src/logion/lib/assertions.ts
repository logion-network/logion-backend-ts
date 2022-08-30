export function requireDefined<T>(value: T | undefined | null, errorSupplier?: () => Error): T {
    if(!value) {
        if (errorSupplier) {
            throw errorSupplier();
        } else {
            throw new Error("Value is undefined");
        }
    } else {
        return value;
    }

}

export function requireLength<T>(obj: T, property: keyof T, minLength:number, maxLength:number): string {
    const key = String(property);
    const value:string = obj[property] as unknown as string
    if (!value) {
        throw new Error(`Value of [${key}] is not defined`)
    }
    if (value.length < minLength || value.length > maxLength) {
        throw new Error(`Value for [${key}] must have length [${minLength},${maxLength}]`)
    }
    return value;
}
