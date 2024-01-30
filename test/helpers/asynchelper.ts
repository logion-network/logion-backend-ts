

export function expectAsyncToThrow<T>(func: () => Promise<T>, expectedError?: string, errorMessage?: string): Promise<void> {
    const promise = func();
    return promise
        .then(_ => fail("Call succeeded while an error was expected to throw"))
        .catch(error => {
            if (expectedError) {
                expect(error.toString()).toEqual(`Error: ${ expectedError }`);
            }
            if (errorMessage) {
                expect(error.content.errorMessage).toEqual(errorMessage);
            }
        });
}
