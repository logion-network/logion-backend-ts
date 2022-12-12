import { requireDefined } from "@logion/rest-api-core";
import { injectable } from "inversify";
import { LocRequestAggregateRoot, LocRequestRepository } from "../../model/locrequest.model";
import { PostalAddress } from "../../model/postaladdress";
import { UserIdentity } from "../../model/useridentity";
import { components } from "../components";
import { VerifiedThirdPartyAdapter } from "./verifiedthirdpartyadapter";

export type UserPrivateData = {
    identityLocId: string | undefined,
    userIdentity: UserIdentity | undefined,
    userPostalAddress: PostalAddress | undefined
};

type LocRequestView = components["schemas"]["LocRequestView"];
type UserIdentityView = components["schemas"]["UserIdentityView"];
type PostalAddressView = components["schemas"]["PostalAddressView"];

@injectable()
export class LocRequestAdapter {

    constructor(
        private locRequestRepository: LocRequestRepository,
        private verifiedThirdPartyAdapter: VerifiedThirdPartyAdapter,
    ) {

    }

    async toView(request: LocRequestAggregateRoot, viewer: string, userPrivateDataArg?: UserPrivateData): Promise<LocRequestView> {
        let userPrivateData: UserPrivateData;
        if(userPrivateDataArg) {
            userPrivateData = userPrivateDataArg;
        } else {
            userPrivateData = await this.findUserPrivateData(request);
        }

        const id = requireDefined(request.id);
        const locDescription = request.getDescription();
        const view: LocRequestView = {
            id,
            requesterAddress: locDescription.requesterAddress,
            requesterIdentityLoc: locDescription.requesterIdentityLoc,
            ownerAddress: locDescription.ownerAddress,
            description: locDescription.description,
            locType: locDescription.locType,
            identityLoc: userPrivateData.identityLocId,
            userIdentity: this.toUserIdentityView(userPrivateData.userIdentity),
            userPostalAddress: this.toUserPostalAddressView(userPrivateData.userPostalAddress),
            createdOn: locDescription.createdOn || undefined,
            status: request.status,
            rejectReason: request.rejectReason || undefined,
            decisionOn: request.decisionOn || undefined,
            closedOn: request.closedOn || undefined,
            files: request.getFiles(viewer).map(file => ({
                name: file.name,
                hash: file.hash,
                nature: file.nature,
                addedOn: file.addedOn?.toISOString() || undefined,
                submitter: file.submitter,
            })),
            metadata: request.getMetadataItems(viewer).map(item => ({
                name: item.name,
                value: item.value,
                addedOn: item.addedOn?.toISOString() || undefined,
                submitter: item.submitter,
            })),
            links: request.getLinks(viewer).map(link => ({
                target: link.target,
                nature: link.nature,
                addedOn: link.addedOn?.toISOString() || undefined,
            })),
            seal: locDescription.seal?.hash,
            company: locDescription.company,
            verifiedThirdParty: locDescription.verifiedThirdParty,
            selectedParties: await this.verifiedThirdPartyAdapter.selectedParties(id),
        };
        const voidInfo = request.getVoidInfo();
        if(voidInfo !== null) {
            view.voidInfo = {
                reason: voidInfo.reason,
                voidedOn: voidInfo.voidedOn?.toISOString()
            };
        }
        return view;
    }

    async findUserPrivateData(request: LocRequestAggregateRoot): Promise<UserPrivateData> {
        const description = request.getDescription();
        if (description.locType === 'Identity') {
            return {
                identityLocId: undefined,
                ...description
            };
        }
        if (description.requesterAddress) {
            const identityLoc = (await this.locRequestRepository.findBy({
                expectedLocTypes: [ "Identity" ],
                expectedIdentityLocType: "Polkadot",
                expectedRequesterAddress: description.requesterAddress,
                expectedOwnerAddress: description.ownerAddress,
                expectedStatuses: [ "CLOSED" ]
            })).find(loc => loc.getVoidInfo() === null);
            if (identityLoc) {
                return {
                    identityLocId: identityLoc.id,
                    ...identityLoc.getDescription()
                }
            }
        }
        if (description.requesterIdentityLoc) {
            const identityLoc = await this.locRequestRepository.findById(description.requesterIdentityLoc)
            if (identityLoc) {
                return {
                    identityLocId: identityLoc.id,
                    ...identityLoc.getDescription()
                }
            }
        }
        return {
            identityLocId: undefined,
            ...description
        };
    }

    private toUserIdentityView(userIdentity: UserIdentity | undefined): UserIdentityView | undefined {
        if (userIdentity === undefined) {
            return undefined;
        }
        return {
            firstName: userIdentity.firstName,
            lastName: userIdentity.lastName,
            email: userIdentity.email,
            phoneNumber: userIdentity.phoneNumber,
        }
    }

    private toUserPostalAddressView(userPostalAddress: PostalAddress | undefined): PostalAddressView | undefined {
        if (userPostalAddress === undefined) {
            return undefined;
        }
        return {
            line1: userPostalAddress.line1,
            line2: userPostalAddress.line2,
            postalCode: userPostalAddress.postalCode,
            city: userPostalAddress.city,
            country: userPostalAddress.country,
        }
    }
}
