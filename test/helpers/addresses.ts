import { ValidAccountId } from "@logion/node-api";
import { LegalOfficerDescription } from "../../src/logion/model/legalofficer.model";

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

export const LEGAL_OFFICERS: LegalOfficerDescription[] = [
    {
        account: ALICE_ACCOUNT,
        userIdentity: {
            firstName: "Alice",
            lastName: "Alice",
            email: "alice@logion.network",
            phoneNumber: "+32 498 00 00 00",
        },
        postalAddress: {
            company: "MODERO",
            line1: "Huissier de Justice Etterbeek",
            line2: "Rue Beckers 17",
            postalCode: "1040",
            city: "Etterbeek",
            country: "Belgique"
        },
        additionalDetails: "",
    },
    {
        account: BOB_ACCOUNT,
        userIdentity: {
            firstName: "Bob",
            lastName: "Bob",
            email: "bob@logion.network",
            phoneNumber: "+33 4 00  00 00 00",
        },
        postalAddress: {
            company: "SELARL ADRASTEE",
            line1: "Gare des Brotteaux",
            line2: "14, place Jules Ferry",
            postalCode: "69006",
            city: "Lyon",
            country: "France"
        },
        additionalDetails: "",
    },
    {
        account: CHARLY_ACCOUNT,
        userIdentity: {
            firstName: "Charlie",
            lastName: "Charlie",
            email: "charlie@logion.network",
            phoneNumber: "+33 2 00 00 00 00",
        },
        postalAddress: {
            company: "AUXILIA CONSEILS 18",
            line1: "Huissiers de Justice associés",
            line2: "7 rue Jean Francois Champollion Parc Comitec",
            postalCode: "18000",
            city: "Bourges",
            country: "France"
        },
        additionalDetails: "",
    }
]
