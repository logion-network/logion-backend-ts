import { polkadotAccount } from "../../src/logion/model/supportedaccountid.model.js";

export const ALICE = "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY";
export const DEFAULT_LEGAL_OFFICER = ALICE;
export const BOB = "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty";
export const CHARLY = "5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y";

export const ALICE_ACCOUNT = polkadotAccount(ALICE);
export const BOB_ACCOUNT = polkadotAccount(BOB);
export const CHARLY_ACCOUNT = polkadotAccount(CHARLY);
