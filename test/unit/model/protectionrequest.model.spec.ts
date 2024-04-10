import { v4 as uuid } from 'uuid';
import moment from 'moment';

import {
    ProtectionRequestDescription,
    ProtectionRequestFactory,
    ProtectionRequestAggregateRoot, ProtectionRequestStatus,
} from '../../../src/logion/model/protectionrequest.model.js';
import { CHARLY_ACCOUNT, ALICE_ACCOUNT, BOB_ACCOUNT } from '../../helpers/addresses.js';
import { Mock, It } from "moq.ts";
import {
    LocRequestRepository,
    LocRequestAggregateRoot,
    LocRequestStatus
} from "../../../src/logion/model/locrequest.model.js";
import { EmbeddableUserIdentity } from "../../../src/logion/model/useridentity.js";
import { EmbeddablePostalAddress } from "../../../src/logion/model/postaladdress.js";
import { expectAsyncToThrow } from "../../helpers/asynchelper.js";
import { ValidAccountId } from "@logion/node-api";
import { EmbeddableNullableAccountId, DB_SS58_PREFIX } from "../../../src/logion/model/supportedaccountid.model.js";

describe('ProtectionRequestFactoryTest', () => {

    it('createsPendingRequests', async () => {
        const result = await newProtectionRequestUsingFactory();

        expect(result.id!).toBe(id);
        expect(result.getDescription()).toEqual(description);
        expect(result.status).toBe('PENDING');
    });

    it('fails to create a protection request with MISSING identity LOC', async () => {
        const locRequestRepository = new Mock<LocRequestRepository>();
        locRequestRepository.setup(instance => instance.findById(It.IsAny<string>()))
            .returns(Promise.resolve(null));
        const factory = new ProtectionRequestFactory(locRequestRepository.object());
        await expectAsyncToThrow(
            () => factory.newProtectionRequest({
                id,
                requesterIdentityLoc: "missing",
                ...description,
            }),
            undefined,
            "Identity LOC not found"
        )
    });

    it('fails to create a protection request with OPEN identity LOC', async () => {
        await expectAsyncToThrow(
            () => newProtectionRequestUsingFactory(undefined, "OPEN"),
            undefined,
            "Identity LOC not valid"
        )
    });
});

describe('ProtectionRequestAggregateRootTest', () => {

    it('accepts', async () => {
        const request = await newProtectionRequestUsingFactory();
        const decisionOn = moment();

        request.accept(decisionOn);

        expect(request.status).toBe('ACCEPTED');
        expect(request.decision!.decisionOn).toBe(decisionOn.toISOString());
    });

    it('rejects', async () => {
        const request = await newProtectionRequestUsingFactory();
        const decisionOn = moment();
        const reason = "Because.";

        request.reject(reason, decisionOn);

        expect(request.status).toBe('REJECTED');
        expect(request.decision!.decisionOn).toBe(decisionOn.toISOString());
    });

    it('fails on re-accept', async () => {
        const request = await newProtectionRequestUsingFactory();
        const decisionOn = moment();
        request.accept(decisionOn);

        expect(() => request.accept(decisionOn)).toThrowError();
    });

    it('fails on re-reject', async () => {
        const request = await newProtectionRequestUsingFactory();
        const decisionOn = moment();
        request.reject("", decisionOn);

        expect(() => request.reject("", decisionOn)).toThrowError();
    });

    it("resubmit", async () => {
        const request = await newProtectionRequestUsingFactory("REJECTED");
        request.resubmit();
        expect(request.status).toEqual("PENDING")
    });

    it("cancels a pending protection request ", async () => {
        const request = await newProtectionRequestUsingFactory();
        request.cancel();
        expect(request.status).toEqual("CANCELLED")
    });

    it("cancels a rejected protection request", async () => {
        const request = await newProtectionRequestUsingFactory("REJECTED");
        request.cancel();
        expect(request.status).toEqual("REJECTED_CANCELLED")
    });

    it("cancels an accepted protection request ", async () => {
        const request = await newProtectionRequestUsingFactory("ACCEPTED");
        request.cancel();
        expect(request.status).toEqual("ACCEPTED_CANCELLED")
    });

    it("updates", async () => {
        const request = await newProtectionRequestUsingFactory();
        request.updateOtherLegalOfficer(CHARLY_ACCOUNT.getAddress(DB_SS58_PREFIX));
        expect(request.otherLegalOfficerAddress).toEqual(CHARLY_ACCOUNT.getAddress(DB_SS58_PREFIX));
    });
});


const id = uuid();
const userIdentity = {
    email: "john.doe@logion.network",
    firstName: "John",
    lastName: "Doe",
    phoneNumber: "+1234",
};
const userPostalAddress = {
    line1: "Place de le République Française, 10",
    line2: "boite 15",
    postalCode: "4000",
    city: "Liège",
    country: "Belgium",
};
const description: ProtectionRequestDescription = {
    requesterAddress: ValidAccountId.polkadot("5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW"),
    requesterIdentityLocId: "80124e8a-a7d8-456f-a7be-deb4e0983e87",
    legalOfficerAddress: ALICE_ACCOUNT,
    otherLegalOfficerAddress: BOB_ACCOUNT,
    createdOn: moment().toISOString(),
    isRecovery: false,
    addressToRecover: null,
};

async function newProtectionRequestUsingFactory(status?: ProtectionRequestStatus, identityLocStatus?: LocRequestStatus): Promise<ProtectionRequestAggregateRoot> {

    const identityLoc = new LocRequestAggregateRoot();
    identityLoc.id = "80124e8a-a7d8-456f-a7be-deb4e0983e87";
    identityLoc.locType = "Identity";
    if (identityLocStatus) {
        identityLoc.status = identityLocStatus;
    } else {
        identityLoc.status = "CLOSED";
    }
    identityLoc.userIdentity = EmbeddableUserIdentity.from(userIdentity);
    identityLoc.userPostalAddress = EmbeddablePostalAddress.from(userPostalAddress);
    identityLoc.requester = EmbeddableNullableAccountId.from(description.requesterAddress);
    identityLoc.ownerAddress = description.legalOfficerAddress.address;

    const locRequestRepository = new Mock<LocRequestRepository>();
    locRequestRepository.setup(instance => instance.findById(It.IsAny<string>()))
        .returns(Promise.resolve(identityLoc));

    const factory = new ProtectionRequestFactory(locRequestRepository.object());
    const protectionRequest = await factory.newProtectionRequest({
        id,
        requesterIdentityLoc: identityLoc.id!,
        ...description,
    });
    if (status) {
        protectionRequest.status = status;
    }
    return protectionRequest;
}
