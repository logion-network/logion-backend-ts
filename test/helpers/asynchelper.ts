

export function expectAsyncToThrow(func: () => Promise<void>, expectedError: string): Promise<void> {
    const promise = func();
    return promise
        .then(_ => fail("Call succeeded while an error was expected to throw"))
        .catch(error => expect(error.toString()).toEqual(`Error: ${ expectedError }`));
}
