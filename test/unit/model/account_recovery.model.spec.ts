import { v4 as uuid } from 'uuid';
import moment from 'moment';

import {
    AccountRecoveryRequestDescription,
    AccountRecoveryRequestFactory,
    AccountRecoveryRequestAggregateRoot, AccountRecoveryRequestStatus,
} from '../../../src/logion/model/account_recovery.model.js';
import { ALICE_ACCOUNT, BOB_ACCOUNT } from '../../helpers/addresses.js';
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
import { EmbeddableNullableAccountId } from "../../../src/logion/model/supportedaccountid.model.js";

describe('AccountRecoveryFactory', () => {

    it('creates pending request', async () => {
        const result = await newRecoveryRequestUsingFactory();

        expect(result.id!).toBe(id);
        expect(result.getDescription()).toEqual(description);
        expect(result.status).toBe('PENDING');
    });

    it('fails to create a request with MISSING identity LOC', async () => {
        const locRequestRepository = new Mock<LocRequestRepository>();
        locRequestRepository.setup(instance => instance.findById(It.IsAny<string>()))
            .returns(Promise.resolve(null));
        const factory = new AccountRecoveryRequestFactory(locRequestRepository.object());
        await expectAsyncToThrow(
            () => factory.newAccountRecoveryRequest({
                requesterIdentityLoc: "missing",
                ...description,
            }),
            undefined,
            "Identity LOC not found"
        )
    });

    it('fails to create a request with OPEN identity LOC', async () => {
        await expectAsyncToThrow(
            () => newRecoveryRequestUsingFactory(undefined, "OPEN"),
            undefined,
            "Identity LOC not valid"
        )
    });
});

describe('AccountRecoveryRequestAggregateRoot', () => {

    it('accepts', async () => {
        const request = await newRecoveryRequestUsingFactory();
        const decisionOn = moment();

        request.accept(decisionOn);

        expect(request.status).toBe('ACCEPTED');
        expect(request.decision!.decisionOn).toBe(decisionOn.toISOString());
    });

    it('rejects', async () => {
        const request = await newRecoveryRequestUsingFactory();
        const decisionOn = moment();
        const reason = "Because.";

        request.reject(reason, decisionOn);

        expect(request.status).toBe('REJECTED');
        expect(request.decision!.decisionOn).toBe(decisionOn.toISOString());
    });

    it('fails on re-accept', async () => {
        const request = await newRecoveryRequestUsingFactory();
        const decisionOn = moment();
        request.accept(decisionOn);

        expect(() => request.accept(decisionOn)).toThrowError();
    });

    it('fails on re-reject', async () => {
        const request = await newRecoveryRequestUsingFactory();
        const decisionOn = moment();
        request.reject("", decisionOn);

        expect(() => request.reject("", decisionOn)).toThrowError();
    });

    it("cancels a pending protection request ", async () => {
        const request = await newRecoveryRequestUsingFactory();
        request.cancel();
        expect(request.status).toEqual("CANCELLED")
    });

    it("cancels a rejected protection request", async () => {
        const request = await newRecoveryRequestUsingFactory("REJECTED");
        request.cancel();
        expect(request.status).toEqual("REJECTED_CANCELLED")
    });

    it("cancels an accepted protection request ", async () => {
        const request = await newRecoveryRequestUsingFactory("ACCEPTED");
        request.cancel();
        expect(request.status).toEqual("ACCEPTED_CANCELLED")
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
const description: AccountRecoveryRequestDescription = {
    id,
    status: "PENDING",
    requesterAddress: ValidAccountId.polkadot("5Ew3MyB15VprZrjQVkpQFj8okmc9xLDSEdNhqMMS5cXsqxoW"),
    requesterIdentityLocId: "80124e8a-a7d8-456f-a7be-deb4e0983e87",
    legalOfficerAddress: ALICE_ACCOUNT,
    otherLegalOfficerAddress: BOB_ACCOUNT,
    createdOn: moment().toISOString(),
    addressToRecover: ValidAccountId.polkadot("vQvrwS6w8eXorsbsH4cp6YdNtEegZYH9CvhHZizV2p9dPGyDJ"),
};

async function newRecoveryRequestUsingFactory(status?: AccountRecoveryRequestStatus, identityLocStatus?: LocRequestStatus): Promise<AccountRecoveryRequestAggregateRoot> {

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

    const factory = new AccountRecoveryRequestFactory(locRequestRepository.object());
    const request = await factory.newAccountRecoveryRequest({
        requesterIdentityLoc: identityLoc.id!,
        ...description,
    });
    if (status) {
        request.status = status;
    }
    return request;
}
