import { Hash } from "@logion/node-api";
import { It } from "moq.ts";

export function ItIsHash(expected: Hash) {
    return It.Is<Hash>(given => given.equalTo(expected));
}
