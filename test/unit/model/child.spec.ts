import { HasIndex } from "../../../src/logion/lib/db/collections";
import { deleteIndexedChild, Child } from "../../../src/logion/model/child";

describe("child", () => {

    it("deleteIndexedChild", () => {

        type Test = Child & HasIndex & { name: string }

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
})
