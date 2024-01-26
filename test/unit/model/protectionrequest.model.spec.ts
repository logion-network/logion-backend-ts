import { v4 as uuid } from 'uuid';
import moment from 'moment';

import {
    ProtectionRequestDescription,
    ProtectionRequestFactory,
    ProtectionRequestAggregateRoot, ProtectionRequestStatus,
} from '../../../src/logion/model/protectionrequest.model.js';
import { BOB, CHARLY, ALICE } from '../../helpers/addresses.js';
import { Mock, It } from "moq.ts";
import {
    LocRequestRepository,
    LocRequestAggregateRoot,
    LocRequestStatus
} from "../../../src/logion/model/locrequest.model.js";
import { EmbeddableUserIdentity } from "../../../src/logion/model/useridentity.js";
import { EmbeddablePostalAddress } from "../../../src/logion/model/postaladdress.js";
import { expectAsyncToThrow } from "../../helpers/asynchelper.js";

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
        const locId = "locId";

        request.accept(decisionOn, locId);

        expect(request.status).toBe('ACCEPTED');
        expect(request.decision!.decisionOn).toBe(decisionOn.toISOString());
        expect(request.decision!.locId).toBe(locId);
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
        const locId = "locId";
        request.accept(decisionOn, locId);

        expect(() => request.accept(decisionOn, locId)).toThrowError();
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
        request.updateOtherLegalOfficer(CHARLY);
        expect(request.otherLegalOfficerAddress).toEqual(CHARLY);
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
    requesterAddress: "5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW",
    requesterIdentityLocId: "80124e8a-a7d8-456f-a7be-deb4e0983e87",
    legalOfficerAddress: ALICE,
    otherLegalOfficerAddress: BOB,
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
    identityLoc.requesterAddress = description.requesterAddress;
    identityLoc.requesterAddressType = "Polkadot";
    identityLoc.ownerAddress = description.legalOfficerAddress;

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
