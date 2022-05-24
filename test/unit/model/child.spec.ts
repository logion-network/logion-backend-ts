import { deleteIndexedChild, IndexedChild } from "../../../src/logion/model/child";

describe("child", () => {

    it("deleteIndexedChild with re-indexation", () => {

        type Test = IndexedChild & { name: string }

        const children: Test [] = [
            { name: "abc", index: 2 },
            { name: "def", index: 1 },
            { name: "ghi", index: 0 },
        ]
        const expectedChildrenAfterDelete: Test [] = [
            { name: "abc", index: 1, _toUpdate: true },
            { name: "ghi", index: 0 },
        ]
        const childrenToDelete: Test[] = [];
        // delete "def"
        deleteIndexedChild(1, children, childrenToDelete)
        expect(children).toEqual(expectedChildrenAfterDelete)
        expect(childrenToDelete[0].name).toEqual("def")
    })

    it("deleteIndexedChild without re-indexation", () => {

        type Test = IndexedChild & { name: string }

        const children: Test [] = [
            { name: "abc", index: 2 },
            { name: "ghi", index: 0 },
            { name: "def", index: 1 },
        ]
        const expectedChildrenAfterDelete: Test [] = [
            { name: "ghi", index: 0 },
            { name: "def", index: 1 },
        ]
        const childrenToDelete: Test[] = [];
        // delete "abc"
        deleteIndexedChild(0, children, childrenToDelete)
        expect(children).toEqual(expectedChildrenAfterDelete)
        expect(childrenToDelete[0].name).toEqual("abc")
    })
})
