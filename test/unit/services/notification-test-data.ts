import { ProtectionRequestDescription, LegalOfficerDecision } from "../../../src/logion/model/protectionrequest.model";
import { BOB, ALICE } from "../../helpers/addresses";
import { LegalOfficer } from "../../../src/logion/model/legalofficer.model";
import { LocRequestDescription, LocRequestDecision } from "../../../src/logion/model/locrequest.model";
import { VaultTransferRequestDescription } from "src/logion/model/vaulttransferrequest.model";

export const notifiedProtection: ProtectionRequestDescription & { decision: Partial<LegalOfficerDecision> } = {
    requesterAddress: "5H4MvAsobfZ6bBCDyj5dsrWYLrA8HrRzaqa9p61UXtxMhSCY",
    otherLegalOfficerAddress: BOB,
    addressToRecover: "5GEZAeYtVZPEEmCT66scGoWS4Jd7AWJdXeNyvxC3LxKP8jCn",
    createdOn: "2021-06-10T16:25:23.668294",
    isRecovery: false,
    userIdentity: {
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@logion.network",
        phoneNumber: "123456"
    },
    userPostalAddress: {
        line1: "Rue de la Paix",
        line2: "",
        postalCode: "4000",
        city: "Liège",
        country: "Belgium"
    },
    decision: {
        decisionOn: "2021-06-10T16:25:23.668294",
        rejectReason: "Failed to provide some data",
        locId: "103850a5-84f5-4ba9-bad8-f10fdbab3592",
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
            phoneNumber: "123465"
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

export function notifiedLOC(): LocRequestDescription & { decision: LocRequestDecision } {
    return {
        ownerAddress: ALICE,
        description: "Some LOC description",
        createdOn: "2021-06-10T16:25:23.668294",
        locType: "Transaction",
        decision: {
            decisionOn: "2021-06-10T16:25:23.668294",
            rejectReason: "Failed to provide some data",
        },
        userIdentity: undefined
    }
}

const vaultTransfer: VaultTransferRequestDescription = {
    id: "id",
    requesterAddress: "5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW",
    destination: "5EBxoSssqNo23FvsDeUxjyQScnfEiGxJaNwuwqBH2Twe35BX",
    createdOn: "2021-06-10T16:25:23.668294",
    amount: 10000n,
    call: '0x0303005e017e03e2ee7a0a97e2e5df5cd902aa0b976d65eac998889ea40992efc3d254070010a5d4e8',
    timepoint: {
        blockNumber: 42n,
        extrinsicIndex: 1
    }
};

export function notificationData() {
    const lo = notifiedLegalOfficer(ALICE);
    const otherLo = notifiedLegalOfficer(BOB);
    return {
        protection: notifiedProtection,
        legalOfficer: lo,
        otherLegalOfficer: otherLo,
        walletUser: notifiedProtection.userIdentity,
        walletUserPostalAddress: notifiedProtection.userPostalAddress,
        loc: notifiedLOC(),
        vaultTransfer
    }
}

