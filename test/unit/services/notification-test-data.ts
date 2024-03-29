import {
    ProtectionRequestDescription,
    LegalOfficerDecisionDescription
} from "../../../src/logion/model/protectionrequest.model.js";
import { BOB, ALICE } from "../../helpers/addresses.js";
import { LegalOfficer } from "../../../src/logion/model/legalofficer.model.js";
import { LocRequestDescription, LocRequestDecision } from "../../../src/logion/model/locrequest.model.js";
import { VaultTransferRequestDescription } from "src/logion/model/vaulttransferrequest.model.js";

export const notifiedProtection: ProtectionRequestDescription & { decision: LegalOfficerDecisionDescription } = {
    requesterAddress: "5H4MvAsobfZ6bBCDyj5dsrWYLrA8HrRzaqa9p61UXtxMhSCY",
    requesterIdentityLocId: "7a6ca6b7-87ca-4e55-9c5f-422c9f799b74",
    legalOfficerAddress: ALICE,
    otherLegalOfficerAddress: BOB,
    addressToRecover: "5GEZAeYtVZPEEmCT66scGoWS4Jd7AWJdXeNyvxC3LxKP8jCn",
    createdOn: "2021-06-10T16:25:23.668294",
    isRecovery: false,
    decision: {
        decisionOn: "2021-06-10T16:25:23.668294",
        rejectReason: "Failed to provide some data",
    }
}

export function notifiedLegalOfficer(address:string): LegalOfficer {
    return {
        address,
        additionalDetails: "some details",
        node: "http://localhost:8080",
        userIdentity: {
            firstName: address === BOB ? "Bob": "Alice",
            lastName: "Network",
            email: address === BOB ? "bob@logion.network" : "alice@logion.network",
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

export function notifiedLOC(): LocRequestDescription & { decision: LocRequestDecision } & { id: string } {
    return {
        id: "15ed922d-5960-4147-a73f-97d362cb7c46",
        ownerAddress: ALICE,
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
    requesterAddress: "5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW",
    legalOfficerAddress: ALICE,
    origin: "5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW",
    destination: "5EBxoSssqNo23FvsDeUxjyQScnfEiGxJaNwuwqBH2Twe35BX",
    createdOn: "2021-06-10T16:25:23.668294",
    amount: 10000n,
    timepoint: {
        blockNumber: 42n,
        extrinsicIndex: 1
    },
};

export function notificationData() {
    const lo = notifiedLegalOfficer(ALICE);
    const otherLo = notifiedLegalOfficer(BOB);
    return {
        protection: notifiedProtection,
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
        }
    }
}

