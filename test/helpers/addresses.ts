import { ValidAccountId } from "@logion/node-api";

// Note to developers: Addresses are encoded
// using a different custom prefix: 0 (= Polkadot)
// As a consequence, those 3 constants should be used only in REST API URL or payload,
// where prefix is irrelevant.
//
// For any other usage, (i.e. mocking behavior, asserting value, etc.)
// You should use either ALICE_ACCOUNT.getAddress(DB_SS58_PREFIX) or ALICE_ACCOUNT.address
export const ALICE = "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5";
export const BOB = "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3";
export const CHARLY = "14Gjs1TD93gnwEBfDMHoCgsuf1s2TVKUP6Z1qKmAZnZ8cW5q";

export const ALICE_ACCOUNT = ValidAccountId.polkadot(ALICE);
export const BOB_ACCOUNT = ValidAccountId.polkadot(BOB);
export const CHARLY_ACCOUNT = ValidAccountId.polkadot(CHARLY);
