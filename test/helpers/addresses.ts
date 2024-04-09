import { ValidAccountId } from "@logion/node-api";

// Note to developers: in order to ensure that tests are properly configured, all addresses are encoded
// using a different custom prefix: 0 (= Polkadot)
export const ALICE = "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5";
export const DEFAULT_LEGAL_OFFICER = ALICE;
export const BOB = "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3";
export const CHARLY = "14Gjs1TD93gnwEBfDMHoCgsuf1s2TVKUP6Z1qKmAZnZ8cW5q";

export const ALICE_ACCOUNT = ValidAccountId.polkadot(ALICE);
export const BOB_ACCOUNT = ValidAccountId.polkadot(BOB);
export const CHARLY_ACCOUNT = ValidAccountId.polkadot(CHARLY);
