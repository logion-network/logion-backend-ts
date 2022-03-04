import {
    ProtectionRequestDescription,
    LegalOfficerDecisionDescription
} from "../../../src/logion/model/protectionrequest.model";
import { BOB, ALICE } from "../../helpers/addresses";
import { LegalOfficer } from "../../../src/logion/model/legalofficer.model";
import { LocRequestDescription, LocRequestDecision } from "../../../src/logion/model/locrequest.model";

export const notifiedProtection: ProtectionRequestDescription & { decision: LegalOfficerDecisionDescription } = {
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

export function notificationData() {
    const lo = notifiedLegalOfficer(ALICE);
    const otherLo = notifiedLegalOfficer(BOB);
    return {
        protection: notifiedProtection,
        legalOfficer: lo,
        otherLegalOfficer: otherLo,
        walletUser: notifiedProtection.userIdentity,
        walletUserPostalAddress: notifiedProtection.userPostalAddress,
        loc: notifiedLOC()
    }
}

