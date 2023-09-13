import { Hash } from "@logion/node-api";
import { It } from "moq.ts";
import { SupportedAccountId } from "../../src/logion/model/supportedaccountid.model.js";

export function ItIsHash(expected: Hash) {
    return It.Is<Hash>(given => given.equalTo(expected));
}

export function ItIsAccount(account: string) {
    return It.Is<SupportedAccountId>(given => given.address === account && given.type === "Polkadot");
}
