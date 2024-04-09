import { Hash, ValidAccountId } from "@logion/node-api";
import { It } from "moq.ts";
import { SupportedAccountId } from "../../src/logion/model/supportedaccountid.model.js";

export function ItIsHash(expected: Hash) {
    return It.Is<Hash>(given => given.equalTo(expected));
}

export function ItIsAccount(account: ValidAccountId) {
    return It.Is<ValidAccountId>(given => given.equals(account));
}
