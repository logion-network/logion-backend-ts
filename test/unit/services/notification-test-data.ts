import {
    AccountRecoveryRequestDescription,
} from "../../../src/logion/model/account_recovery.model.js";
import { ALICE_ACCOUNT, BOB_ACCOUNT } from "../../helpers/addresses.js";
import { LegalOfficerDescription } from "../../../src/logion/model/legalofficer.model.js";
import { VaultTransferRequestDescription } from "src/logion/model/vaulttransferrequest.model.js";
import { ValidAccountId } from "@logion/node-api";
import { LocRequestDecision, LocRequestDescription } from "src/logion/model/loc_vos.js";
import { SecretRecoveryRequestDescription } from "src/logion/model/secret_recovery.model.js";
import moment from "moment";
import { LegalOfficerDecisionDescription } from "src/logion/model/decision.js";

export const recovery: AccountRecoveryRequestDescription & { decision: LegalOfficerDecisionDescription } = {
    id: "a7ff4ab6-5bef-4310-9c28-bcbd653565c3",
    status: "PENDING",
    requesterAddress: ValidAccountId.polkadot("5H4MvAsobfZ6bBCDyj5dsrWYLrA8HrRzaqa9p61UXtxMhSCY"),
    requesterIdentityLocId: "7a6ca6b7-87ca-4e55-9c5f-422c9f799b74",
    legalOfficerAddress: ALICE_ACCOUNT,
    otherLegalOfficerAddress: BOB_ACCOUNT,
    addressToRecover: ValidAccountId.polkadot("5GEZAeYtVZPEEmCT66scGoWS4Jd7AWJdXeNyvxC3LxKP8jCn"),
    createdOn: "2021-06-10T16:25:23.668294",
    decision: {
        decisionOn: "2021-06-10T16:25:23.668294",
        rejectReason: "Failed to provide some data",
    }
}

export function notifiedLegalOfficer(address:string): LegalOfficerDescription {
    return {
        account: ValidAccountId.polkadot(address),
        additionalDetails: "some details",
        userIdentity: {
            firstName: address === BOB_ACCOUNT.address ? "Bob": "Alice",
            lastName: "Network",
            email: address === BOB_ACCOUNT.address ? "bob@logion.network" : "alice@logion.network",
            phoneNumber: "123465",
        },
        postalAddress: {
            company: "Alice & Co",
            line1: "Rue de la Paix",
            line2: "",
            postalCode: "4000",
            city: "Liège",
            country: "Belgium"
        }
    };
}

const requesterAddress = ValidAccountId.polkadot("5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW");

export function notifiedLOC(): LocRequestDescription & { decision: LocRequestDecision } & { id: string } {
    return {
        id: "15ed922d-5960-4147-a73f-97d362cb7c46",
        ownerAddress: ALICE_ACCOUNT,
        requesterAddress,
        description: "Some LOC description",
        createdOn: "2021-06-10T16:25:23.668294",
        locType: "Transaction",
        decision: {
            decisionOn: "2021-06-10T16:25:23.668294",
            rejectReason: "Failed to provide some data",
        },
        userIdentity: undefined,
        userPostalAddress: undefined,
        fees: {
            legalFee: 2000n,
        }
    }
}

const vaultTransfer: VaultTransferRequestDescription = {
    id: "id",
    requesterAddress: requesterAddress,
    legalOfficerAddress: ALICE_ACCOUNT,
    origin: requesterAddress,
    destination: ValidAccountId.polkadot("5EBxoSssqNo23FvsDeUxjyQScnfEiGxJaNwuwqBH2Twe35BX"),
    createdOn: "2021-06-10T16:25:23.668294",
    amount: 10000n,
    timepoint: {
        blockNumber: 42n,
        extrinsicIndex: 1
    },
};

const secret: SecretRecoveryRequestDescription = {
    id: "id",
    challenge: "00475b3e-cf23-4fdc-a057-80372dc44f9e",
    createdOn: moment("2021-06-10T16:25:23.668294"),
    requesterIdentityLocId: "0f9ce42d-e020-4168-a5aa-e72618a8a882",
    secretName: "Key",
    status: "REJECTED",
    userIdentity: {
        firstName: "John",
        lastName: "Doe",
        email: "john@doe.com",
        phoneNumber: "123465",
    },
    userPostalAddress: {
        line1: "Rue de la Paix",
        line2: "",
        postalCode: "4000",
        city: "Liège",
        country: "Belgium"
    },
    downloaded: false,
};

export function notificationData() {
    const lo = notifiedLegalOfficer(ALICE_ACCOUNT.address);
    const otherLo = notifiedLegalOfficer(BOB_ACCOUNT.address);
    return {
        recovery,
        legalOfficer: lo,
        otherLegalOfficer: otherLo,
        walletUser: {
            firstName: "John",
            lastName: "Doe",
            email: "john.doe@logion.network",
            phoneNumber: "123456",
        },
        walletUserPostalAddress: {
            line1: "Rue de la Paix",
            line2: "",
            postalCode: "4000",
            city: "Liège",
            country: "Belgium"
        },
        loc: notifiedLOC(),
        vaultTransfer: {
            ...vaultTransfer,
            decision: {
                decisionOn: "2021-06-10T16:25:23.668294",
                rejectReason: "Failed to provide some data",
            }
        },
        secret: {
            ...secret,
            decision: {
                decisionOn: "2021-06-10T16:25:23.668294",
                rejectReason: "Failed to provide some data",
            }
        }
    }
}
